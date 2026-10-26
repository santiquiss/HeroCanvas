-- The comments table, for the Supabase project in herocanvas.config.ts `comments`. Run once in the project's SQL Editor (it can run
-- again: it only creates what's missing and resets the permissions).
--
-- What the site's key (the publishable / anon key) may do: read every comment, add one, resolve or reopen a thread, and
-- edit or delete your own — through edit_comment and delete_comment, which check the secret of the browser it was left
-- from against its `owner` (comments/owner.ts). Nobody can change who wrote a comment, or edit or delete anyone else's;
-- that's done in the Supabase dashboard (Table Editor) if ever needed.

create table if not exists public.comments (
  id uuid primary key,
  created_at timestamptz not null default now(),
  -- 'live' or a proposal's code (PJ-12)
  design text not null check (char_length(design) between 1 and 40),
  -- the proposal's version (a, b…), or null
  variant text check (char_length(variant) <= 20),
  -- the page id (app/pages.tsx)
  page text not null check (char_length(page) between 1 and 80),
  -- the view it was left on (route + query)
  link text not null check (char_length(link) <= 4000),
  -- where its pin goes (root comments): { component, nth, ox, oy, x, y }
  anchor jsonb,
  parent_id uuid references public.comments (id),
  kind text not null check (kind in ('design', 'handoff', 'copy', 'dev', 'question')),
  author text not null check (char_length(author) between 1 and 60),
  body text not null check (char_length(body) between 1 and 4000),
  resolved_at timestamptz,
  resolved_by text check (char_length(resolved_by) <= 60)
);

-- 0.34.0: who may edit or delete it (the SHA-256, in hex, of the secret of the browser it was left from), and when it
-- was last edited.
alter table public.comments add column if not exists owner text check (owner ~ '^[0-9a-f]{64}$');
alter table public.comments add column if not exists edited_at timestamptz;

create index if not exists comments_design on public.comments (design, created_at);

alter table public.comments enable row level security;

-- Only what the plugin needs: read, add, and the two columns of resolving.
revoke all on public.comments from anon, authenticated;
grant select, insert on public.comments to anon, authenticated;
grant update (resolved_at, resolved_by) on public.comments to anon, authenticated;

drop policy if exists "read comments" on public.comments;
create policy "read comments" on public.comments for select to anon, authenticated using (true);

-- A new comment starts open, unedited, and now.
drop policy if exists "add comments" on public.comments;
create policy "add comments" on public.comments for insert to anon, authenticated
  with check (resolved_at is null and resolved_by is null and edited_at is null and created_at > now() - interval '1 hour' and created_at < now() + interval '1 hour');

-- Only threads (root comments) are resolved.
drop policy if exists "resolve threads" on public.comments;
create policy "resolve threads" on public.comments for update to anon, authenticated
  using (parent_id is null) with check (parent_id is null);

-- Your comment: its new text, when `secret` is the one of the browser it was left from.
create or replace function public.edit_comment(comment_id uuid, secret text, new_body text)
returns public.comments
language plpgsql security definer set search_path = public
as $$
declare
  saved public.comments;
begin
  update public.comments set body = new_body, edited_at = now()
    where id = comment_id and owner = encode(sha256(convert_to(secret, 'UTF8')), 'hex')
    returning * into saved;
  if saved.id is null then
    raise exception 'Not your comment' using errcode = '42501';
  end if;
  return saved;
end;
$$;

-- Delete your comment; a thread's first one takes its replies with it.
create or replace function public.delete_comment(comment_id uuid, secret text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.comments where id = comment_id and owner = encode(sha256(convert_to(secret, 'UTF8')), 'hex')) then
    raise exception 'Not your comment' using errcode = '42501';
  end if;
  delete from public.comments where parent_id = comment_id;
  delete from public.comments where id = comment_id;
end;
$$;

revoke all on function public.edit_comment(uuid, text, text) from public;
revoke all on function public.delete_comment(uuid, text) from public;
grant execute on function public.edit_comment(uuid, text, text) to anon, authenticated;
grant execute on function public.delete_comment(uuid, text) to anon, authenticated;

-- @mentions: who a comment mentions, by their Slack member id (herocanvas.config.ts `comments.team`). Set when it's
-- left; editing it later tells no one.
alter table public.comments add column if not exists mentions text[]
  check (mentions is null or (cardinality(mentions) between 1 and 20 and array_to_string(mentions, ',') ~ '^[A-Z0-9]+(,[A-Z0-9]+)*$'));

-- Telling who's mentioned, in Slack: a message in the team's channel through an Incoming Webhook that @mentions them (so
-- Slack notifies them), with what was said and a link that opens the comment. Needs, once, in the Vault (Project
-- Settings › Vault, or here):
--   select vault.create_secret('https://hooks.slack.com/services/…', 'comments_slack_webhook');
--   select vault.create_secret('https://the-site.example', 'comments_site_url');  -- where the designer is published
-- Without the webhook, comments are left as always and no one is told.
create extension if not exists pg_net;

create or replace function public.notify_mentions()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  hook text;
  site text;
  who text;
  said text;
  msg text;
begin
  select decrypted_secret into hook from vault.decrypted_secrets where name = 'comments_slack_webhook';
  select decrypted_secret into site from vault.decrypted_secrets where name = 'comments_site_url';
  if hook is null or new.mentions is null then
    return new;
  end if;
  select string_agg('<@' || m || '>', ' ') into who from unnest(new.mentions) as m;
  -- Slack's own characters, escaped: what was written can't @channel or make links.
  said := replace(replace(replace(left(new.body, 300), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || case when char_length(new.body) > 300 then '…' else '' end;
  msg := who || ' ' || replace(replace(replace(new.author, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || ' mentioned you in *'
    || case when new.design = 'live' then 'Live' else new.design end || ' · ' || new.page || E'*\n> ' || replace(said, E'\n', E'\n> ');
  if site is not null then
    msg := msg || E'\n<' || rtrim(site, '/') || '/#' || new.link || case when position('?' in new.link) > 0 then '&' else '?' end || 'comment=' || new.id || '|Open the comment>';
  end if;
  perform net.http_post(url := hook, body := jsonb_build_object('text', msg), headers := '{"Content-Type": "application/json"}'::jsonb);
  return new;
exception when others then
  -- Telling is a courtesy: a comment is never refused because Slack couldn't be told.
  return new;
end;
$$;

revoke all on function public.notify_mentions() from public, anon, authenticated;

drop trigger if exists comments_notify_mentions on public.comments;
create trigger comments_notify_mentions after insert on public.comments
  for each row when (new.mentions is not null) execute function public.notify_mentions();

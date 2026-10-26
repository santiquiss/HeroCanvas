// @mentions in a comment: the team (herocanvas.config.ts `comments.team`, each with their Slack member id), the name
// being typed after an @ (the field's suggestions), and who a text mentions — whom the store tells in Slack
// (supabase.sql's notify_mentions). A mention is the text itself (`@Robin Lopez`): nothing else to keep in step.

export interface Person {
  name: string;
  slack: string;
}

/** Who can be mentioned; none: the @ suggests no one (a team without one set up). */
export const TEAM: Person[] = __HC_TEAM__;

/** At most this many told about one comment (the table's check). */
export const MAX_MENTIONS = 20;

/** The name being typed after an @ right before the cursor: where its @ is and what's typed; null when there's none. */
export function typingMention(text: string, caret: number): { at: number; query: string } | null {
  const m = /(?:^|\s)@([^@\n]{0,30})$/u.exec(text.slice(0, caret));
  return m ? { at: caret - m[1].length - 1, query: m[1] } : null;
}

/** The people whose name starts with what's typed (or, one word typed, one of whose names does). */
export function suggestions(people: Person[], query: string, max = 8): Person[] {
  const q = query.toLowerCase();
  return people
    .filter((p) => {
      const n = p.name.toLowerCase();
      return n.startsWith(q) || (!q.includes(' ') && n.split(/\s+/).some((w) => w.startsWith(q)));
    })
    .slice(0, max);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `@Name` as a whole: after a space (or first), and not followed by more of a word. */
const mentionPattern = (people: Person[], flags: string) =>
  people.length ? new RegExp(`(^|\\s)(@(?:${[...people].sort((a, b) => b.name.length - a.name.length).map((p) => escape(p.name)).join('|')}))(?![\\p{L}\\p{N}])`, flags) : null;

/** The people a text mentions, each once, in the team's order. */
export function mentionedIn(text: string, people: Person[] = TEAM): Person[] {
  const re = mentionPattern(people, 'giu');
  if (!re) return [];
  const names = new Set([...text.matchAll(re)].map((m) => m[2].slice(1).toLowerCase()));
  return people.filter((p) => names.has(p.name.toLowerCase())).slice(0, MAX_MENTIONS);
}

/** A new comment's mentions as the store keeps them: their Slack member ids (none: null). */
export function mentionsOf(text: string, people: Person[] = TEAM): string[] | null {
  const ids = mentionedIn(text, people).map((p) => p.slack);
  return ids.length ? ids : null;
}

/** A text in pieces, the mentions apart (to show them as such). */
export function splitMentions(text: string, people: Person[] = TEAM): { text: string; mention: boolean }[] {
  const re = mentionPattern(people, 'giu');
  if (!re) return [{ text, mention: false }];
  const out: { text: string; mention: boolean }[] = [];
  let from = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index! + m[1].length;
    if (at > from) out.push({ text: text.slice(from, at), mention: false });
    out.push({ text: m[2], mention: true });
    from = at + m[2].length;
  }
  if (from < text.length) out.push({ text: text.slice(from), mention: false });
  return out;
}

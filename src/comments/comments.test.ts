import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anchorAt, anchorElement, fractionIn, GALLERY_SCREEN, pageLayer, pagesAbove, pointIn, screenAttrs, screenOf, showsOn } from './anchor';
import { screenScope } from './CommentsContext';
import { localBackend, supabaseBackend, uploadBrowserComments } from './backend';
import { myOwner, sha256Hex } from './owner';
import { addComment, deleteComment, editComment, refresh, setBackendForTests, setResolved } from './store';
import { mentionsOf, splitMentions, suggestions, typingMention } from './mentions';
import { commentLink, filterThreads, initials, openByPage, personColor, threadMatches, threadNumbers, threadsOf, timeAgo } from './threads';
import { componentOfPage, componentPage, type Comment } from './types';

let n = 0;
const comment = (over: Partial<Comment> = {}): Comment => ({
  id: `c${++n}`,
  createdAt: new Date(Date.UTC(2026, 9, 14, 10, n)).toISOString(),
  design: 'PT-1',
  variant: null,
  page: 'today',
  link: '/today?proposal=PT-1',
  anchor: { component: 'Button', nth: 0, ox: 0.5, oy: 0.5, x: 0.2, y: 0.3 },
  parentId: null,
  kind: 'design',
  author: 'Casey',
  body: 'Bigger?',
  resolvedAt: null,
  resolvedBy: null,
  ...over,
});

describe('threads', () => {
  it('groups replies under their root, newest thread first, replies oldest first', () => {
    const a = comment();
    const b = comment();
    const r2 = comment({ parentId: a.id, createdAt: '2026-10-14T12:00:00.000Z' });
    const r1 = comment({ parentId: a.id, createdAt: '2026-10-14T11:00:00.000Z' });
    const orphan = comment({ parentId: 'gone' });
    const threads = threadsOf([a, b, r2, r1, orphan]);
    expect(threads.map((t) => t.root.id)).toEqual([b.id, a.id]);
    expect(threads[1].replies.map((r) => r.id)).toEqual([r1.id, r2.id]);
  });

  it('filters by page, kind, state and version (a comment on no version shows on every one)', () => {
    const onA = comment({ variant: 'a' });
    const onB = comment({ variant: 'b', kind: 'handoff' });
    const any = comment({ page: 'projects' });
    const done = comment({ resolvedAt: '2026-10-14T12:00:00.000Z', resolvedBy: 'Ana' });
    const t = threadsOf([onA, onB, any, done]);
    const ids = (f: Parameters<typeof filterThreads>[1]) => filterThreads(t, f).map((x) => x.root.id).sort();
    expect(ids({})).toEqual([onA.id, onB.id, any.id].sort());
    expect(ids({ resolved: true })).toHaveLength(4);
    expect(ids({ variant: 'b' })).toEqual([onB.id, any.id].sort());
    expect(ids({ kinds: ['handoff'] })).toEqual([onB.id]);
    expect(ids({ page: 'projects' })).toEqual([any.id]);
  });

  it('counts open threads per page', () => {
    const list = [comment(), comment(), comment({ page: 'projects' }), comment({ resolvedAt: 'x' }), comment({ parentId: 'c1' })];
    expect(Object.fromEntries(openByPage(list))).toEqual({ today: 2, projects: 1 });
    expect(openByPage(list)).toBe(openByPage(list));
  });

  it('reads dates and names short', () => {
    const now = Date.parse('2026-10-14T12:00:00Z');
    expect(timeAgo('2026-10-14T11:59:30Z', now)).toBe('now');
    expect(timeAgo('2026-10-14T11:15:00Z', now)).toBe('45m');
    expect(timeAgo('2026-10-14T07:00:00Z', now)).toBe('5h');
    expect(timeAgo('2026-10-11T12:00:00Z', now)).toBe('3d');
    expect(initials('Ana Silva')).toBe('AS');
    expect(initials(' casey ')).toBe('C');
  });

  it('numbers threads in the order they were left, and finds them by text, author or page', () => {
    const first = comment({ createdAt: '2026-10-14T09:00:00.000Z', body: 'Spacing under the title' });
    const second = comment({ createdAt: '2026-10-14T10:00:00.000Z', author: 'Casey' });
    const reply = comment({ parentId: second.id, body: 'Agreed, ship it' });
    const threads = threadsOf([second, first, reply]);
    expect(Object.fromEntries(threadNumbers(threads))).toEqual({ [first.id]: 1, [second.id]: 2 });
    // Each design counts its own: listed with another's, a thread keeps its number.
    const live = comment({ design: 'live' });
    expect(threadNumbers(threadsOf([first, live, second])).get(live.id)).toBe(1);
    expect(threadNumbers(threadsOf([first, live, second])).get(second.id)).toBe(2);
    const [t2, t1] = threads;
    expect(threadMatches(t1, 'spacing')).toBe(true);
    expect(threadMatches(t2, 'ship')).toBe(true);
    expect(threadMatches(t2, 'casey')).toBe(true);
    expect(threadMatches(t1, 'weight', 'Weight')).toBe(true);
    expect(threadMatches(t1, 'nothing')).toBe(false);
  });

  it('gives each person one color', () => {
    expect(personColor('Casey')).toBe(personColor(' casey '));
    expect(personColor('Casey')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('links to the view without the viewer’s zoom', () => {
    expect(commentLink('/today', '?proposal=PT-1&zoom=2&device=ipad11')).toBe('/today?proposal=PT-1&device=ipad11');
    expect(commentLink('/projects', '?zoom=1')).toBe('/projects');
  });
});

describe('anchor', () => {
  const box = { left: 100, top: 50, width: 200, height: 100 };
  it('turns a point into fractions of a box and back', () => {
    expect(fractionIn(box, 150, 75)).toEqual({ fx: 0.25, fy: 0.25 });
    expect(pointIn(box, 0.25, 0.25)).toEqual({ x: 150, y: 75 });
    // Outside the box: clamped to its edge.
    expect(fractionIn(box, 0, 500)).toEqual({ fx: 0, fy: 1 });
  });

  // A device frame: the base page, a page pushed over it, one covered, and a sheet over them all (sim/screenLayer).
  const frame = () => {
    const f = document.createElement('div');
    f.innerHTML = `
      <div data-page-id="projects"><p id="base"></p></div>
      <div data-page-id="profile" style="visibility: hidden"></div>
      <div data-page-id="project"><p id="pushed"></p></div>
      <div style="display: contents"><div data-sheet-id="editProject"><div id="sheet"></div></div></div>`;
    return f;
  };
  it('puts a click on its page, and one on a sheet on the page on top', () => {
    const f = frame();
    expect(anchorAt(f, f.querySelector('#base')!, 0, 0)?.page).toBe('projects');
    expect(anchorAt(f, f.querySelector('#sheet')!, 0, 0)?.page).toBe('project');
    // Off any component: the point of the page, not the sheet's (there's nothing of it to follow).
    expect(anchorAt(f, f.querySelector('#sheet')!, 0, 0)?.anchor.overlay).toBeUndefined();
    // Under a pushed page, a pin doesn't show.
    const base = f.querySelector<HTMLElement>('[data-page-id="projects"]')!;
    expect(pagesAbove(f, base).map((el) => el.dataset.pageId)).toEqual(['profile', 'project']);
    // No page (a boot page): nowhere to leave it.
    expect(anchorAt(document.createElement('div'), document.createElement('span'), 0, 0)).toBeNull();
  });
  it('hides a pin on a sheet that isn’t open, or whose page isn’t on top', () => {
    const f = frame();
    const page = f.querySelector<HTMLElement>('[data-page-id="project"]')!;
    const a = { component: 'Sheet', nth: 0, ox: 0.5, oy: 0.5, x: 0.5, y: 0.5 };
    expect(anchorElement(f, page, { ...a, overlay: true })).toBeNull();
    expect(anchorElement(f, page, { ...a, overlay: true, sheet: 'plus' })).toBeNull();
    expect(anchorElement(f, f.querySelector<HTMLElement>('[data-page-id="projects"]')!, { ...a, overlay: true })).toBeNull();
    // On the page, a component that's gone leaves the pin at its point of the page.
    expect(anchorElement(f, page, a)).toEqual({ el: page, onComponent: false });
  });
  // The gallery: a component's examples side by side, each a page of the component's (gallery/Gallery).
  it('puts a click in the gallery on its example, and none off them', () => {
    const f = document.createElement('div');
    for (const [k, v] of Object.entries(screenAttrs(GALLERY_SCREEN))) f.setAttribute(k, v);
    const page = componentPage('Button');
    f.innerHTML = `
      <h1 id="title">Button</h1>
      <div data-page-id="${page}" data-hc-page="Primary"><p id="primary"></p></div>
      <div data-page-id="${page}" data-hc-page="Disabled"><p id="disabled"></p></div>`;
    expect(screenOf(f)?.screen.bare).toBe(true);
    const at = anchorAt(f, f.querySelector('#disabled')!, 0, 0);
    expect(at?.page).toBe(page);
    expect(at?.anchor.story).toBe('Disabled');
    expect(pageLayer(f, page, 'Disabled')?.dataset.hcPage).toBe('Disabled');
    // A title, the margin: on no example (not the last one, as off a device's pages).
    expect(anchorAt(f, f.querySelector('#title')!, 0, 0)).toBeNull();
    expect(componentOfPage(page)).toBe('Button');
    expect(componentOfPage('foodSearch')).toBeNull();
  });
});

describe('devices', () => {
  it('shows a pin on the device it was left on (any device when it names none)', () => {
    const duo = { device: 'iphoneduo', display: 'outer' };
    expect(showsOn({ device: 'iphoneduo', display: 'outer' }, duo)).toBe(true);
    expect(showsOn({ device: 'iphoneduo', display: 'inner' }, duo)).toBe(false);
    expect(showsOn({ device: 'iphone17pro', display: 'main' }, duo)).toBe(false);
    expect(showsOn({}, duo)).toBe(true);
  });

  it('reads a device’s own version, else the toolbar’s', () => {
    const global = { design: 'PT-9', variant: 'b' };
    expect(screenScope({}, global)).toBe(global);
    expect(screenScope({ design: 'live' }, global)).toEqual({ design: 'live', variant: null });
    expect(screenScope({ design: 'ZZ-404~c' }, global)).toEqual({ design: 'ZZ-404', variant: 'c' });
  });
});

describe('store', () => {
  beforeEach(() => setBackendForTests(localBackend(null)));

  it('adds, resolves and reopens, and a refresh keeps what was saved', async () => {
    const backend = localBackend(null);
    setBackendForTests(backend);
    const c = comment({ design: 'live' });
    await addComment(c);
    await setResolved('live', c.id, 'Ana');
    await refresh('live');
    const [saved] = await backend.list('live');
    expect(saved.resolvedBy).toBe('Ana');
    expect(saved.resolvedAt).not.toBeNull();
    await setResolved('live', c.id, null);
    expect((await backend.list('live'))[0].resolvedAt).toBeNull();
  });

  it('undoes a comment the backend refuses', async () => {
    setBackendForTests({ kind: 'shared', list: async () => [], listAll: async () => [], add: async () => Promise.reject(new Error('no')), resolve: async () => {}, edit: async () => Promise.reject(new Error('no')), remove: async () => {} });
    await refresh('live');
    await expect(addComment(comment({ design: 'live' }))).rejects.toThrow('no');
  });

  it('edits and deletes only your own; a thread goes with its replies', async () => {
    const backend = localBackend(null);
    setBackendForTests(backend);
    const root = comment({ design: 'live' });
    await addComment(root);
    const [saved] = await backend.list('live');
    expect(saved.owner).toBe(await myOwner());
    await editComment(saved, 'Smaller?');
    const [edited] = await backend.list('live');
    expect(edited.body).toBe('Smaller?');
    expect(edited.editedAt).not.toBeNull();
    // Someone else's (another browser's secret, or none: older comments) is refused.
    await backend.add(comment({ design: 'live', owner: await sha256Hex('another browser') }));
    const [, theirs] = await backend.list('live');
    await expect(editComment(theirs, 'Mine now')).rejects.toThrow('Not your comment');
    await expect(deleteComment({ ...theirs, owner: null })).rejects.toThrow('Not your comment');
    await addComment(comment({ design: 'live', parentId: root.id, anchor: null }));
    await deleteComment(edited);
    expect((await backend.list('live')).map((c) => c.id)).toEqual([theirs.id]);
  });

  it('hashes the secret as Postgres does', async () => {
    // select encode(sha256(convert_to('abc', 'UTF8')), 'hex')
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('keeps each design apart', async () => {
    const backend = localBackend(null);
    await backend.add(comment({ design: 'live' }));
    await backend.add(comment({ design: 'PT-2' }));
    expect(await backend.list('PT-2')).toHaveLength(1);
    expect(await backend.listAll()).toHaveLength(2);
  });
});

describe('a browser’s comments, shared once the store is connected', () => {
  const storage = (items: Record<string, string>) => ({
    items,
    getItem: (k: string) => items[k] ?? null,
    setItem: (k: string, v: string) => void (items[k] = v),
    removeItem: (k: string) => void delete items[k],
  });

  it('sends them and keeps a copy aside; nothing kept, nothing sent', async () => {
    const root = comment({ design: 'live' });
    const s = storage({ 'hc.comments': JSON.stringify([root]) });
    const sent: string[][] = [];
    expect(await uploadBrowserComments({ upload: async (cs) => void sent.push(cs.map((c) => c.id)) }, s)).toBe(1);
    expect(sent).toEqual([[root.id]]);
    expect(s.items['hc.comments']).toBeUndefined();
    expect(JSON.parse(s.items['hc.comments.uploaded'])).toHaveLength(1);
    expect(await uploadBrowserComments({ upload: async () => void sent.push([]) }, s)).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('keeps them when sending fails, to try again', async () => {
    const s = storage({ 'hc.comments': JSON.stringify([comment({ design: 'live' })]) });
    await expect(uploadBrowserComments({ upload: () => Promise.reject(new Error('offline')) }, s)).rejects.toThrow('offline');
    expect(JSON.parse(s.items['hc.comments'])).toHaveLength(1);
  });

  it('sends threads before replies, open, dated now when the table refuses their date, then resolves', async () => {
    const root = comment({ design: 'live', createdAt: '2026-10-23T10:00:00.000Z', resolvedAt: '2026-10-24T10:00:00.000Z', resolvedBy: 'Casey' });
    const reply = comment({ design: 'live', parentId: root.id, anchor: null, createdAt: '2026-10-23T11:00:00.000Z' });
    const calls: { method: string; rows: { id: string; created_at: string; resolved_at: string | null }[] | Record<string, unknown> }[] = [];
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ method: String(init.method), rows: body });
      // As the table's policy: only comments dated about now.
      const old = Array.isArray(body) && body.some((r: { created_at: string }) => Date.now() - Date.parse(r.created_at) > 3_600_000);
      return new Response(old ? 'new row violates row-level security policy' : '', { status: old ? 403 : 201 });
    });
    vi.stubGlobal('fetch', fetch);
    try {
      await supabaseBackend('https://x.supabase.co', 'sb_publishable_x').upload([reply, root]);
    } finally {
      vi.unstubAllGlobals();
    }
    const posts = calls.filter((c) => c.method === 'POST').map((c) => c.rows as { id: string; created_at: string; resolved_at: string | null }[]);
    expect(posts.map((rows) => rows.map((r) => r.id))).toEqual([[root.id], [root.id], [reply.id], [reply.id]]);
    expect(posts[0][0].created_at).toBe(root.createdAt);
    expect(posts.every((rows) => rows.every((r) => r.resolved_at === null))).toBe(true);
    expect(calls.at(-1)).toEqual({ method: 'PATCH', rows: { resolved_at: root.resolvedAt, resolved_by: 'Casey' } });
  });
});

describe('mentions', () => {
  const team = [
    { name: 'Robin Lopez', slack: 'U1' },
    { name: 'Robinson Gray', slack: 'U2' },
    { name: 'Britt', slack: 'U3' },
  ];

  it('finds the name being typed after an @', () => {
    expect(typingMention('Hi @Rob', 7)).toEqual({ at: 3, query: 'Rob' });
    expect(typingMention('@', 1)).toEqual({ at: 0, query: '' });
    expect(typingMention('mail@x', 6)).toBeNull();
    expect(typingMention('Hi @Robin L and more', 11)).toEqual({ at: 3, query: 'Robin L' });
  });

  it('suggests by the start of the name or of one of its words', () => {
    expect(suggestions(team, 'rob').map((p) => p.slack)).toEqual(['U1', 'U2']);
    expect(suggestions(team, 'lopez').map((p) => p.slack)).toEqual(['U1']);
    expect(suggestions(team, 'robin l').map((p) => p.slack)).toEqual(['U1']);
    expect(suggestions(team, 'x')).toEqual([]);
  });

  it('knows who a text mentions, whole names only', () => {
    expect(mentionsOf('@Robin Lopez can you check? cc @britt', team)).toEqual(['U1', 'U3']);
    // "@Robinson" isn't "@Robin", and an email isn't a mention.
    expect(mentionsOf('@Robinson Gray and robin@x.com', team)).toEqual(['U2']);
    expect(mentionsOf('no one', team)).toBeNull();
    expect(splitMentions('Ok @Britt, thanks', team)).toEqual([
      { text: 'Ok ', mention: false },
      { text: '@Britt', mention: true },
      { text: ', thanks', mention: false },
    ]);
  });
});

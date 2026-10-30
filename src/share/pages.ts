// The door's pages (src/share/gate.ts): small, self-contained HTML, before any of the designer loads. In English,
// as HeroCanvas's server messages; the designer's own interface is translated, these are seen once.

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const shell = (name: string, body: string, script = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(name)}</title>
<style>
  :root { color-scheme: light dark; --bg: #eeeeee; --card: #ffffff; --tx: #161616; --muted: #6b6b6b; --bd: #d2d6dc; --err: #c8102e; --brand: #0072c8; }
  @media (prefers-color-scheme: dark) { :root { --bg: #161616; --card: #232323; --tx: #f2f2f2; --muted: #a0a0a0; --bd: #3a3a3a; --err: #ff6b6b; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--tx);
    font: 15px/22px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .card { width: 100%; max-width: 320px; padding: 24px; border-radius: 16px; background: var(--card); display: grid; gap: 12px; }
  h1 { margin: 0; font-size: 17px; line-height: 24px; font-weight: 600; }
  p { margin: 0; color: var(--muted); font-size: 13px; line-height: 18px; }
  input, button { font: inherit; height: 44px; border-radius: 12px; }
  input { padding: 0 12px; border: 1px solid var(--bd); background: transparent; color: var(--tx); }
  button { border: none; background: var(--brand); color: #ffffff; font-weight: 600; cursor: pointer; }
  .err { color: var(--err); }
</style>
</head>
<body>
${body}
${script ? `<script>${script}</script>` : ''}
</body>
</html>`;

/** The team's password page: it posts to /__login and sends the hash back (deep links live in it). */
export function loginPage(name: string, o: { error?: string }): string {
  const err = o.error ? `<p class="err">${escape(o.error)}</p>` : '';
  return shell(
    name,
    `<form class="card" method="post" action="/__login">
  <h1>${escape(name)}</h1>
  <p>Enter the team password. This browser will remember it for 30 days.</p>
  <input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required>
  <input type="hidden" name="hash" id="hash">
  ${err}
  <button type="submit">Continue</button>
</form>`,
    `document.getElementById('hash').value = location.hash;`,
  );
}

/** A guest link past its time (opened again, or the site used after it). */
export const expiredPage = (name: string) => messagePage(name, 'This link has expired. Ask whoever shared it for a new one.');

export const messagePage = (name: string, message: string) =>
  shell(
    name,
    `<div class="card">
  <h1>${escape(name)}</h1>
  <p>${escape(message)}</p>
</div>`,
  );

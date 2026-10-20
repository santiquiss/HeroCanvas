// Who is using this browser: their name (on the proposals they create, on their comments) and their letters in a
// proposal's code. Remembered here, not checked: the site's password is the team's.
const AUTHOR_KEY = 'hc.proposal-author';

export interface Author {
  name: string;
  letters: string;
}

export function recalledAuthor(): Author {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTHOR_KEY) || '{}');
    return { name: typeof saved.name === 'string' ? saved.name : '', letters: typeof saved.letters === 'string' ? saved.letters : '' };
  } catch {
    return { name: '', letters: '' };
  }
}

export function rememberAuthor(author: Partial<Author>) {
  try {
    localStorage.setItem(AUTHOR_KEY, JSON.stringify({ ...recalledAuthor(), ...author }));
  } catch {
    /* storage unavailable */
  }
}

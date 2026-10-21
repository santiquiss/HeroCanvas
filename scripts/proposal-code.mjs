// `npm run proposal:code [-- <letters>]`: the code for a new proposal (src/proposals/code.ts): the author's next one.
// The author's letters are the argument, or the first letter of `git config user.name`.
// For a proposal created by hand or by an agent; the Proposal panel gives a new proposal its code by itself.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorLetters, defaultAuthorLetters, nextProposalCode } from '../src/proposals/code.ts';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../proposals');
const taken = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(DIR, e.name, 'proposal.json')))
  .map((e) => JSON.parse(readFileSync(join(DIR, e.name, 'proposal.json'), 'utf8')).code)
  .filter(Boolean);

const gitName = () => {
  try {
    return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const letters = process.argv[2] ? authorLetters(process.argv[2]) : defaultAuthorLetters(gitName());
if (!letters) {
  console.error('proposal:code: whose is it? Pass the author\'s letters: npm run proposal:code -- J');
  process.exit(1);
}
console.log(nextProposalCode(taken, letters));

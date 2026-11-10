// `npm run proposal:code [-- <letters>]`: the code for a new proposal (src/proposals/code.ts): the author's next one.
// The author's letters are the argument, or the first letter of `git config user.name`.
// For a proposal created by hand or by an agent; the Proposal panel gives a new proposal its code by itself.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorLetters, defaultAuthorLetters, nextProposalCode } from '../src/proposals/code.ts';
import { projectsOf, takenCodes } from './vite/projects.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Every project's proposals (herocanvas.config.ts `projects`) and their retired codes (retired.json): a code is the
// copy's, so an author's series goes on across its projects and none is given twice.
const { default: hc } = await import('../herocanvas.config.ts');
const taken = projectsOf(hc.projects).flatMap((p) => takenCodes(ROOT, p));
const retired = [];

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
console.log(nextProposalCode(taken, letters, retired));

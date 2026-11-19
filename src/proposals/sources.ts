// A proposal's specification for whoever implements it (its `handoff.md`): the logic its spec carries (`npm run spec`).
// Loaded on demand: none of it is in the bundle the designer starts with.
import { byFolder } from './folders';

/**
 * The file a proposal keeps its specification in, in English: what changes in each component or screen (in the app's
 * terms: widgets, constructor parameters, the theme's token names), the logic, the data it needs, the new texts, what
 * stays as it is; a part for one version under `### Version A`. Its spec carries it as the proposal's logic.
 */
export const HANDOFF_NOTES_FILE = 'handoff.md';

const loaders = byFolder(import.meta.glob<string>('@proposals/*/handoff.md', { query: '?raw', import: 'default' }), 'handoff.md');

/** Whether the proposal in `folder` has a specification (known without loading it). */
export const hasProposalNotes = (folder: string): boolean => folder in loaders;

/** The specification of the proposal in `folder`, or null when it has none. */
export const loadProposalNotes = async (folder: string): Promise<string | null> => (hasProposalNotes(folder) ? loaders[folder]() : null);

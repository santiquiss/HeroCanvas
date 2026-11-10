// A proposal's specification for whoever implements it (its `handoff.md`), as text, for the handoff file
// (design/proposalHandoff). Loaded on demand: none of it is in the bundle the designer starts with.
import { byFolder } from './folders';

const loaders = byFolder(import.meta.glob<string>('@proposals/*/handoff.md', { query: '?raw', import: 'default' }), 'handoff.md');

/** Whether the proposal in `folder` has a specification (known without loading it). */
export const hasProposalNotes = (folder: string): boolean => folder in loaders;

/** The specification of the proposal in `folder`, or null when it has none. */
export const loadProposalNotes = async (folder: string): Promise<string | null> => (hasProposalNotes(folder) ? loaders[folder]() : null);

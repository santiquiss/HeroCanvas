// A proposal's specification for whoever implements it (its `handoff.md`), as text, for the handoff file
// (design/proposalHandoff). Loaded on demand: none of it is in the bundle the designer starts with.
const loaders = import.meta.glob<string>('/proposals/*/handoff.md', { query: '?raw', import: 'default' });

const key = (folder: string) => `/proposals/${folder}/handoff.md`;

/** Whether the proposal in `folder` has a specification (known without loading it). */
export const hasProposalNotes = (folder: string): boolean => key(folder) in loaders;

/** The specification of the proposal in `folder`, or null when it has none. */
export const loadProposalNotes = async (folder: string): Promise<string | null> => (hasProposalNotes(folder) ? loaders[key(folder)]() : null);

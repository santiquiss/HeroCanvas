// The team's retired proposal codes (proposals/retired.json, proposals/code.ts RetiredCode): codes of proposals deleted
// once done, never given again.
import type { RetiredCode } from './code';

const files = import.meta.glob('/proposals/retired.json', { eager: true, import: 'default' }) as Record<string, RetiredCode[]>;

export const RETIRED_CODES: readonly string[] = (Object.values(files)[0] ?? []).map((r) => r.code);

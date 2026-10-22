// The app's tokens connector (app/connectors/tokens.json): its own catalog of tokens, written by its own script from
// its code and its design file. The Tokens view, Inspect's colors and its text styles read it (design/tokenCatalog,
// design/textStyles); without one they read the `--app-*` variables.

/** What a tokens connector gives (app/connectors/tokens.json), written by the app's own script from its code and design file. */
export interface TokensConnector {
  /** The code (or design file) version the names were read from. */
  version?: string;
  groups: {
    id: string;
    title: string;
    section: 'Colors' | 'Dimensions' | 'Type' | 'Effects' | 'Other';
    note?: string;
    /** How the code reaches the group (`context.colors.background`). */
    codeAccess?: string;
    /** Names the code has in the group that no token matches. */
    codeOnly?: string[];
    /** Each by its CSS variable (without `--`), its name in the design file and in the code, its subgroup. */
    tokens?: { name: string; figma?: string; code?: string | null; sub?: string; kind?: 'color' | 'number' | 'text' }[];
    /** The design file's text styles: each property's CSS variable. */
    textStyles?: { name: string; figma?: string; code?: string | null; props: Partial<Record<'family' | 'size' | 'weight' | 'lineHeight' | 'letterSpacing', string>> }[];
    /** Elevations: each shadow's parts as CSS variables. */
    elevations?: { name: string; figma?: string; code?: string | null; shadows: Partial<Record<'x' | 'y' | 'blur' | 'spread' | 'color', string>>[] }[];
    /** Whether the code's text styles (TokensConnector.textStyles) show in this group. */
    codeTextStyles?: boolean;
  }[];
  /** The text styles the code writes texts with: Inspect names a text by its style (design/textStyles). */
  textStyles?: { name: string; code: string; widget?: string; figma?: string; size: number; line: number; weight: number }[];
}

export const TOKENS_CONNECTOR: TokensConnector | null =
  (Object.values(import.meta.glob('@app/connectors/tokens.json', { eager: true, import: 'default' }))[0] as TokensConnector | undefined) ?? null;


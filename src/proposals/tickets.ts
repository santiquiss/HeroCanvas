// Live's tickets: small changes to the app as it is, each its own ticket for the developers, with no proposal behind
// it (a QA difference, a fix). The team's `proposals/tickets.json`, listed under Live in the design picker; one leaves
// the list when the app has it and Live mirrors it (as a merged proposal's folder goes).
//
//   [{ "ticket": "APP-12", "title": "…", "url": "https://…", "author": "…", "created": "2026-10-23", "summary": "…" }]
export interface LiveTicket {
  /** Its id in the issue tracker (`APP-12`). */
  ticket: string;
  title: string;
  /** Its page in the tracker: the row opens it. */
  url?: string;
  author?: string;
  /** ISO date. */
  created: string;
  /** What it asks for, in one short sentence. */
  summary?: string;
}

const files = import.meta.glob('/proposals/tickets.json', { eager: true, import: 'default' }) as Record<string, LiveTicket[]>;

/** Live's tickets, the newest first. */
export const LIVE_TICKETS: LiveTicket[] = [...(Object.values(files)[0] ?? [])].sort((a, b) => b.created.localeCompare(a.created));

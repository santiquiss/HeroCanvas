// proposals/tickets.json: each Live ticket has its id, a title and an ISO date, and none is listed twice.
import { describe, expect, it } from 'vitest';
import { LIVE_TICKETS } from './tickets';

describe('Live tickets', () => {
  it('are well formed', () => {
    for (const t of LIVE_TICKETS) {
      expect(t.ticket, JSON.stringify(t)).toMatch(/\S/);
      expect(t.title, t.ticket).toMatch(/\S/);
      expect(t.created, t.ticket).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (t.url) expect(t.url, t.ticket).toMatch(/^https?:\/\//);
    }
  });
  it('list each ticket once', () => {
    const ids = LIVE_TICKETS.map((t) => t.ticket);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

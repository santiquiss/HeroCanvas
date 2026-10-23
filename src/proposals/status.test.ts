import { describe, expect, it } from 'vitest';
import { normalizeMeta, type ProposalMeta } from './types';

const meta = (status: string): ProposalMeta => ({ code: 'PT-1', title: 'T', status: status as ProposalMeta['status'], created: '2026-10-23' });

describe('normalizeMeta: the six statuses before 0.50 in today\'s three', () => {
  it('keeps the three of today', () => {
    for (const s of ['draft', 'review', 'handed-off']) expect(normalizeMeta(meta(s)).status).toBe(s);
  });
  it('approved is still in review; merged is past the handoff', () => {
    expect(normalizeMeta(meta('approved')).status).toBe('review');
    expect(normalizeMeta(meta('merged')).status).toBe('handed-off');
  });
  it('archived becomes the flag', () => {
    expect(normalizeMeta(meta('archived'))).toMatchObject({ status: 'draft', archived: true });
  });
  it('anything else is a draft', () => {
    expect(normalizeMeta(meta('whatever')).status).toBe('draft');
  });
});

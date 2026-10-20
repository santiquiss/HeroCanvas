// Which comments are yours. No accounts: this browser keeps a secret of its own, and every comment it leaves carries
// the secret's SHA-256 (`owner`). Editing or deleting one sends the secret, and the table checks it against the hash
// (supabase.sql: edit_comment, delete_comment), so nobody else can change yours. Another browser, or clearing this
// one's data, can't edit what was left before.
import { useEffect, useState } from 'react';

const KEY = 'hc.comment-secret';
let memory = '';

/** This browser's secret: made the first time it's needed. */
export function ownerSecret(): string {
  try {
    let s = localStorage.getItem(KEY);
    if (!s) localStorage.setItem(KEY, (s = crypto.randomUUID() + crypto.randomUUID()));
    return s;
  } catch {
    return (memory ||= crypto.randomUUID() + crypto.randomUUID());
  }
}

/** A text's SHA-256 in hex, as Postgres writes it: encode(sha256(convert_to(text, 'UTF8')), 'hex'). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let known: string | null = null;
let hashing: Promise<string> | null = null;

/** The `owner` this browser's comments carry. */
export function myOwner(): Promise<string> {
  return (hashing ??= sha256Hex(ownerSecret()).then((h) => (known = h)));
}

/** This browser's `owner`; null for the moment it takes to work it out the first time. */
export function useMyOwner(): string | null {
  const [owner, setOwner] = useState(known);
  useEffect(() => {
    if (!owner) void myOwner().then(setOwner);
  }, [owner]);
  return owner;
}

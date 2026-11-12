// A zip written in the browser as its files come: stored, not compressed (PNGs are already), its directory at the end.
// Into a file the person picked (Chrome's showSaveFilePicker: written to disk as it goes, so a whole store's gigabytes
// never sit in memory), or else into a Blob downloaded at the end. Up to 4 GB and 65,535 files (no Zip64).

/** Where a zip goes: chunks written in order, then closed, or dropped (cancelled). */
export interface ZipSink {
  write(chunk: Uint8Array | Blob): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Today in the zip's (MS-DOS) time and date, so the files don't unzip as 1980. */
function dosTime(d = new Date()): [number, number] {
  return [(d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()];
}

export class ZipWriter {
  private at = 0;
  private entries: { name: Uint8Array; crc: number; size: number; at: number }[] = [];
  private readonly time = dosTime();
  private readonly sink: ZipSink;
  constructor(sink: ZipSink) {
    this.sink = sink;
  }

  async add(path: string, data: Uint8Array) {
    const name = new TextEncoder().encode(path);
    const crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    // Bit 11: the name is UTF-8.
    head.setUint16(6, 0x0800, true);
    head.setUint16(10, this.time[0], true);
    head.setUint16(12, this.time[1], true);
    head.setUint32(14, crc, true);
    head.setUint32(18, data.length, true);
    head.setUint32(22, data.length, true);
    head.setUint16(26, name.length, true);
    this.entries.push({ name, crc, size: data.length, at: this.at });
    await this.put(new Uint8Array(head.buffer));
    await this.put(name);
    await this.put(data);
  }

  async close() {
    const start = this.at;
    for (const e of this.entries) {
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(12, this.time[0], true);
      c.setUint16(14, this.time[1], true);
      c.setUint32(16, e.crc, true);
      c.setUint32(20, e.size, true);
      c.setUint32(24, e.size, true);
      c.setUint16(28, e.name.length, true);
      c.setUint32(42, e.at, true);
      await this.put(new Uint8Array(c.buffer));
      await this.put(e.name);
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.entries.length, true);
    end.setUint16(10, this.entries.length, true);
    end.setUint32(12, this.at - start, true);
    end.setUint32(16, start, true);
    await this.put(new Uint8Array(end.buffer));
    await this.sink.close();
  }

  abort() {
    return this.sink.abort();
  }

  private put(b: Uint8Array) {
    this.at += b.length;
    return this.sink.write(b);
  }
}

interface SavePicker {
  showSaveFilePicker?: (o: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable(): Promise<{ write(d: Uint8Array | Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }> }>;
}

/**
 * Where the zip goes: a file the person picks, written as it goes (Chrome, Edge), or memory, downloaded at the end
 * (`download`). Asked for at once, from the click (the picker needs it); null when they close the picker.
 */
export async function zipSink(name: string): Promise<{ sink: ZipSink; download?: () => void } | null> {
  const picker = (window as SavePicker).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: name, types: [{ description: 'Zip', accept: { 'application/zip': ['.zip'] } }] });
      const file = await handle.createWritable();
      return { sink: { write: (c) => file.write(c), close: () => file.close(), abort: () => file.abort() } };
    } catch (e) {
      // Closed: no export. Anything else (a browser that has it but refuses): memory instead.
      if (e instanceof DOMException && e.name === 'AbortError') return null;
    }
  }
  const parts: BlobPart[] = [];
  let blob: Blob | null = null;
  return {
    sink: {
      write: async (c) => void parts.push(c as BlobPart),
      close: async () => void (blob = new Blob(parts, { type: 'application/zip' })),
      abort: async () => void parts.splice(0),
    },
    download: () => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    },
  };
}

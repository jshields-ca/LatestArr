import { promisify } from "node:util";
import { crc32, deflateRaw, inflateRaw } from "node:zlib";

// A minimal ZIP writer and reader for backup archives: a handful of
// deflated files, well under ZIP's 4 GB limits. Small enough to keep here
// rather than add a dependency (Node has the deflate and CRC-32 we need).

const deflate = promisify(deflateRaw);
const inflate = promisify(inflateRaw);

export interface ZipEntry {
  name: string;
  data: Buffer;
}

const LIMIT = 0xffffffff;

/** DOS date and time, as ZIP stores them (local time is conventional; we use UTC). */
function dosDateTime(date: Date): { time: number; day: number } {
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  const day = ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { time, day };
}

export async function createZip(entries: ZipEntry[], modified = new Date()): Promise<Buffer> {
  const { time, day } = dosDateTime(modified);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = await deflate(entry.data);
    if (entry.data.length >= LIMIT || compressed.length >= LIMIT || offset >= LIMIT) {
      throw new Error("The database is too large for a ZIP backup (4 GB or more)");
    }
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header
    local.writeUInt16LE(20, 4); // version needed: 2.0 (deflate)
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** Reads the archives createZip writes (deflated or stored entries, no ZIP64). */
export async function readZip(archive: Buffer): Promise<ZipEntry[]> {
  const endAt = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endAt < 0) throw new Error("Not a ZIP file");
  const count = archive.readUInt16LE(endAt + 10);
  let at = archive.readUInt32LE(endAt + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (archive.readUInt32LE(at) !== 0x02014b50) throw new Error("The ZIP file's directory is damaged");
    const method = archive.readUInt16LE(at + 10);
    const crc = archive.readUInt32LE(at + 16);
    const compressedSize = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const extraLength = archive.readUInt16LE(at + 30);
    const commentLength = archive.readUInt16LE(at + 32);
    const localAt = archive.readUInt32LE(at + 42);
    const name = archive.toString("utf8", at + 46, at + 46 + nameLength);
    at += 46 + nameLength + extraLength + commentLength;

    const dataAt = localAt + 30 + archive.readUInt16LE(localAt + 26) + archive.readUInt16LE(localAt + 28);
    const raw = archive.subarray(dataAt, dataAt + compressedSize);
    const data = method === 8 ? await inflate(raw) : method === 0 ? Buffer.from(raw) : null;
    if (!data) throw new Error(`${name} uses a ZIP compression method LatestArr doesn't read`);
    if (crc32(data) !== crc) throw new Error(`${name} in the ZIP file is damaged`);
    entries.push({ name, data });
  }
  return entries;
}

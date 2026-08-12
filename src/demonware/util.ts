export function writeI32LE(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32LE(value, 0);
  return b;
}

export function readI32LE(buf: Buffer, offset = 0): number {
  return buf.readInt32LE(offset);
}

export function hexPreview(buf: Buffer, max = 64): string {
  const slice = buf.subarray(0, Math.min(buf.length, max));
  const hex = [...slice].map((b) => b.toString(16).padStart(2, "0")).join(" ");
  return buf.length > max ? `${hex} … (+${buf.length - max} bytes)` : hex;
}

import { BitReader, BitWriter } from "./bits/bitstream";
import type { InferSchema, RsatSchema } from "./field";
import {
  array,
  bool,
  bytes,
  f32,
  findByHash,
  i8,
  i16,
  i32,
  i64,
  nested,
  optional,
  optionsArray,
  presentOptions,
  rawBytes,
  repeat,
  schema,
  u8,
  u16,
  u32,
  u64,
} from "./field";

export function encode<T extends Record<string, unknown>>(
  s: RsatSchema<T>,
  value: T
): Buffer {
  const bw = new BitWriter();
  s.encode(bw, value);
  return bw.finish();
}

export function decode<T extends Record<string, unknown>>(
  s: RsatSchema<T>,
  bytes: Buffer
): T {
  const br = new BitReader(bytes);
  return s.decode(br);
}

/**
 * server_message body: u16 network-id | RSAT(args) | optional payload bit.
 */
export function encodeServerMessage<T extends Record<string, unknown>>(
  networkId: number,
  args: RsatSchema<T>,
  value: T,
  optional: Buffer | null = null
): Buffer {
  const bw = new BitWriter();
  bw.write(networkId & 0xffff, 16);
  args.encode(bw, value);
  if (optional) {
    bw.writeBit(1);
    bw.write(optional.length, 16);
    for (const b of optional) {
      bw.write(b, 8);
    }
  } else {
    bw.writeBit(0);
  }
  return bw.finish();
}

/** Inverse of {@link encodeServerMessage}. */
export function decodeServerMessage<T extends Record<string, unknown>>(
  bytes: Buffer,
  args: RsatSchema<T>
): { networkId: number; value: T; optional: Buffer | null } {
  const br = new BitReader(bytes);
  const networkId = br.readNumber(16);
  const value = args.decode(br);
  let optional: Buffer | null = null;
  if (br.readBit()) {
    const len = br.readNumber(16);
    optional = Buffer.alloc(len);
    for (let i = 0; i < len; i++) {
      optional[i] = br.readNumber(8);
    }
  }
  return { networkId, value, optional };
}

export interface QueuezObject {
  /** Registry checksum at object-header +0 (NOT always the TypeDef hash). */
  headerChecksum: number;
  /** RSAT payload bytes (already encoded). */
  payload: Buffer;
  soid: bigint;
}

/** type-123 queuez family-update body framing. */
export function encodeQueuezFamily(opts: {
  familyType: number;
  rootSoid: bigint;
  version?: number;
  flags?: number;
  objects: QueuezObject[];
}): Buffer {
  const version = opts.version ?? 1;
  const flags = opts.flags ?? 1;
  const bw = new BitWriter();
  bw.write(1, 32); // transaction_count
  bw.write(opts.familyType >>> 0, 32);
  bw.write(opts.rootSoid, 64);
  bw.write(version >>> 0, 32);
  bw.write(flags & 0xff, 8);
  bw.write(opts.objects.length >>> 0, 32);
  for (const o of opts.objects) {
    bw.write(o.headerChecksum >>> 0, 32);
    bw.write(o.soid, 64);
    bw.write(o.payload.length >>> 0, 32);
    for (const b of o.payload) {
      bw.write(b, 8);
    }
  }
  return bw.finish();
}

/** Public DSL namespace (`rsat.schema`, `rsat.encode`, `rsat.Infer`, …). */
export const rsat = {
  schema,
  u8,
  u16,
  u32,
  u64,
  i8,
  i16,
  i32,
  i64,
  f32,
  bool,
  optional,
  nested,
  array,
  rawBytes,
  bytes,
  repeat,
  optionsArray,
  presentOptions,
  encode,
  decode,
  encodeServerMessage,
  decodeServerMessage,
  encodeQueuezFamily,
  findByHash,
  BitWriter,
  BitReader,
} as const;

export namespace rsat {
  export type Infer<S> = InferSchema<S>;
}

export { BitReader, BitWriter } from "./bits/bitstream";
export type { InferField, InferSchema, RsatField, RsatSchema } from "./field";
export {
  array,
  bool,
  bytes,
  f32,
  findByHash,
  i8,
  i16,
  i32,
  i64,
  nested,
  optional,
  optionsArray,
  presentOptions,
  rawBytes,
  repeat,
  schema,
  u8,
  u16,
  u32,
  u64,
} from "./field";

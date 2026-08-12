import type { BitReader, BitWriter } from "./bits/bitstream";

/** Runtime field codec. */
export interface RsatField<T> {
  readonly __brand?: T;
  decode(br: BitReader): T;
  encode(bw: BitWriter, value: T): void;
}

export type InferField<F> = F extends RsatField<infer T> ? T : never;

export type InferSchema<S> = S extends RsatSchema<infer T> ? T : never;

export interface RsatSchema<T extends Record<string, unknown>> {
  decode(br: BitReader): T;
  encode(bw: BitWriter, value: T): void;
  readonly fields: { [K in keyof T]: RsatField<T[K]> };
  readonly hash: number;
}

export interface IntOpts {
  /** Added on encode, subtracted on decode (ryods `delta`). */
  bias?: number;
  /** Wire bit width (default = full type width). */
  size?: number;
}

const SCHEMA_REGISTRY = new Map<number, RsatSchema<Record<string, unknown>>>();

export function registerSchema<T extends Record<string, unknown>>(
  schema: RsatSchema<T>
): void {
  SCHEMA_REGISTRY.set(
    schema.hash >>> 0,
    schema as RsatSchema<Record<string, unknown>>
  );
}

export function findByHash(
  hash: number
): RsatSchema<Record<string, unknown>> | undefined {
  return SCHEMA_REGISTRY.get(hash >>> 0);
}

function defaultBias(signed: boolean, size: number): number {
  if (!signed) {
    return 0;
  }
  if (size >= 32) {
    return 0x80000000;
  }
  return 1 << (size - 1);
}

function makeIntField(
  signed: boolean,
  defaultSize: number,
  opts: IntOpts = {}
): RsatField<number> {
  const size = opts.size ?? defaultSize;
  const bias = opts.bias ?? defaultBias(signed, size);
  const mask = size >= 32 ? 0xffffffff : (1 << size) - 1;

  return {
    encode(bw, value) {
      const wire = (value + bias) & mask;
      bw.write(wire >>> 0, size);
    },
    decode(br) {
      const wire = br.readNumber(size);
      return (wire - bias) | 0;
    },
  };
}

function makeBigIntField(
  _signed: boolean,
  defaultSize: number,
  opts: IntOpts = {}
): RsatField<bigint> {
  const size = opts.size ?? defaultSize;
  // u64/i64 on Destiny wire: no bias applied in dump encoder (p0=0, p1=64).
  const bias = opts.bias ?? 0;

  return {
    encode(bw, value) {
      bw.write(value + BigInt(bias), size);
    },
    decode(br) {
      return br.read(size) - BigInt(bias);
    },
  };
}

export function u8(opts?: IntOpts): RsatField<number> {
  return makeIntField(false, 8, opts);
}
export function u16(opts?: IntOpts): RsatField<number> {
  return makeIntField(false, 16, opts);
}
export function u32(opts?: IntOpts): RsatField<number> {
  return makeIntField(false, 32, opts);
}
export function u64(opts?: IntOpts): RsatField<bigint> {
  return makeBigIntField(false, 64, opts);
}
export function i8(opts?: IntOpts): RsatField<number> {
  return makeIntField(true, 8, opts);
}
export function i16(opts?: IntOpts): RsatField<number> {
  return makeIntField(true, 16, opts);
}
export function i32(opts?: IntOpts): RsatField<number> {
  return makeIntField(true, 32, opts);
}
export function i64(opts?: IntOpts): RsatField<bigint> {
  return makeBigIntField(true, 64, opts);
}

/**
 * Destiny kind-11 float32: IEEE-754 bits on the wire (no bias), exposed as JS number.
 */
export function f32(): RsatField<number> {
  const scratch = Buffer.allocUnsafe(4);
  return {
    encode(bw, value) {
      scratch.writeFloatBE(value, 0);
      bw.write(scratch.readUInt32BE(0), 32);
    },
    decode(br) {
      scratch.writeUInt32BE(br.readNumber(32) >>> 0, 0);
      return scratch.readFloatBE(0);
    },
  };
}

/** 1-bit dirty/presence flag then conditional body. */
export function optional<T>(inner: RsatField<T>): RsatField<T | undefined> {
  return {
    encode(bw, value) {
      if (value === undefined || value === null) {
        bw.writeBit(0);
        return;
      }
      bw.writeBit(1);
      inner.encode(bw, value);
    },
    decode(br) {
      if (!br.readBit()) {
        return;
      }
      return inner.decode(br);
    },
  };
}

/** Always-encoded nested schema (dirty_en=0). */
export function nested<T extends Record<string, unknown>>(
  child: RsatSchema<T>
): RsatField<T> {
  return {
    encode(bw, value) {
      child.encode(bw, value);
    },
    decode(br) {
      return child.decode(br);
    },
  };
}

export interface ArrayOpts {
  /** Bit width of the count prefix (ceil_log2(max)). */
  lengthBits: number;
  /** Maximum element count (inclusive). */
  max: number;
}

/**
 * Count-prefixed array of element schemas (Destiny nested array flag).
 * Count is written first with `lengthBits`, then exactly `count` elements.
 */
export function array<T>(elem: RsatField<T>, opts: ArrayOpts): RsatField<T[]> {
  return {
    encode(bw, value) {
      if (value.length > opts.max) {
        throw new Error(`array length ${value.length} exceeds max ${opts.max}`);
      }
      bw.write(value.length, opts.lengthBits);
      for (const item of value) {
        elem.encode(bw, item);
      }
    },
    decode(br) {
      const count = br.readNumber(opts.lengthBits);
      if (count > opts.max) {
        throw new Error(`array count ${count} exceeds max ${opts.max}`);
      }
      const out: T[] = [];
      for (let i = 0; i < count; i++) {
        out.push(elem.decode(br));
      }
      return out;
    },
  };
}

/** Raw byte blob written as 8*length bits (no length prefix). */
export function rawBytes(): RsatField<Buffer> {
  return {
    encode(bw, value) {
      for (const b of value) {
        bw.write(b, 8);
      }
    },
    decode() {
      throw new Error("rawBytes.decode requires an explicit length");
    },
  };
}

/** Fixed-length byte run (always emitted, no length prefix). */
export function bytes(length: number): RsatField<Buffer> {
  return {
    encode(bw, value) {
      if (value.length !== length) {
        throw new Error(`bytes(${length}) got Buffer length ${value.length}`);
      }
      for (const b of value) {
        bw.write(b, 8);
      }
    },
    decode(br) {
      const out = Buffer.alloc(length);
      for (let i = 0; i < length; i++) {
        out[i] = br.readNumber(8);
      }
      return out;
    },
  };
}

/** Destiny kind-2 bool (1 bit). */
export function bool(): RsatField<boolean> {
  return {
    encode(bw, value) {
      bw.writeBit(value ? 1 : 0);
    },
    decode(br) {
      return !!br.readBit();
    },
  };
}

/** Always-emitted fixed-count sequence (dirty_en=0 repeated nests). */
export function repeat<T>(elem: RsatField<T>, count: number): RsatField<T[]> {
  return {
    encode(bw, value) {
      if (value.length !== count) {
        throw new Error(`repeat(${count}) got length ${value.length}`);
      }
      for (const item of value) {
        elem.encode(bw, item);
      }
    },
    decode(br) {
      const out: T[] = [];
      for (let i = 0; i < count; i++) {
        out.push(elem.decode(br));
      }
      return out;
    },
  };
}

/**
 * Fixed-count dirty-gated slots (each element is an Option).
 * Use when dump schemas share a dirty map and only some indices are set —
 * pass `undefined` for clean slots.
 */
export function optionsArray<T>(
  elem: RsatField<T>,
  count: number
): RsatField<(T | undefined)[]> {
  const slot = optional(elem);
  return {
    encode(bw, value) {
      if (value.length !== count) {
        throw new Error(`optionsArray(${count}) got length ${value.length}`);
      }
      for (const item of value) {
        slot.encode(bw, item);
      }
    },
    decode(br) {
      const out: (T | undefined)[] = [];
      for (let i = 0; i < count; i++) {
        out.push(slot.decode(br));
      }
      return out;
    },
  };
}

/**
 * Fixed-count Option slots that are always dirty=1 when the parent nest is
 * present (matches dump shared-map stubs that mark idxs 0..N-1).
 */
export function presentOptions<T>(
  elem: RsatField<T>,
  count: number
): RsatField<T[]> {
  return {
    encode(bw, value) {
      if (value.length !== count) {
        throw new Error(`presentOptions(${count}) got length ${value.length}`);
      }
      for (const item of value) {
        bw.writeBit(1);
        elem.encode(bw, item);
      }
    },
    decode(br) {
      const out: T[] = [];
      for (let i = 0; i < count; i++) {
        if (!br.readBit()) {
          throw new Error(`presentOptions(${count}): missing slot ${i}`);
        }
        out.push(elem.decode(br));
      }
      return out;
    },
  };
}

export function schema<const Fields extends Record<string, RsatField<unknown>>>(
  hash: number,
  fields: Fields
): RsatSchema<{ [K in keyof Fields]: InferField<Fields[K]> }> {
  type Value = { [K in keyof Fields]: InferField<Fields[K]> };

  const s: RsatSchema<Value> = {
    hash: hash >>> 0,
    fields: fields as { [K in keyof Value]: RsatField<Value[K]> },
    encode(bw, value) {
      for (const key of Object.keys(fields) as (keyof Fields)[]) {
        const field = fields[key]!;
        field.encode(bw, value[key as keyof Value] as never);
      }
    },
    decode(br) {
      const out = {} as Value;
      for (const key of Object.keys(fields) as (keyof Fields)[]) {
        const field = fields[key]!;
        out[key as keyof Value] = field.decode(br) as Value[keyof Value];
      }
      return out;
    },
  };

  registerSchema(s as RsatSchema<Record<string, unknown>>);
  return s;
}

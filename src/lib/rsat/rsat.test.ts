import { describe, expect, it } from "vitest";
import { BitReader, BitWriter, rsat } from "./index";

describe("BitWriter/BitReader", () => {
  it("round-trips MSB-first ints", () => {
    const bw = new BitWriter();
    bw.writeBit(1);
    bw.write(0x15, 5);
    bw.write(0x100000001n, 64);
    const bytes = bw.finish();
    const br = new BitReader(bytes);
    expect(br.readBit()).toBe(1);
    expect(br.readNumber(5)).toBe(0x15);
    expect(br.read(64)).toBe(0x100000001n);
  });
});

describe("rsat.f32", () => {
  const S = rsat.schema(0x22222222, {
    a: rsat.f32(),
    b: rsat.optional(rsat.f32()),
  });

  it("round-trips IEEE-754 values", () => {
    const bytes = rsat.encode(S, { a: 0.5, b: -1.25 });
    expect(bytes.readUInt32BE(0)).toBe(0x3f000000);
    const decoded = rsat.decode(S, bytes);
    expect(decoded.a).toBe(0.5);
    expect(decoded.b).toBe(-1.25);
  });
});

describe("rsat.schema Option + bias", () => {
  const S = rsat.schema(0x11111111, {
    flag: rsat.optional(rsat.u32({ size: 8, bias: 0 })),
    always: rsat.i32({ size: 3, bias: 1 }),
  });

  it("encodes absent option as a zero dirty bit", () => {
    const bytes = rsat.encode(S, { flag: undefined, always: 0 });
    // bits: 0 (dirty) + (0+1)=1 over 3 bits → 0b0_001xxxx
    expect(bytes[0]).toBe(0x10);
  });

  it("round-trips present option", () => {
    const bytes = rsat.encode(S, { flag: 7, always: 2 });
    const decoded = rsat.decode(S, bytes);
    expect(decoded.flag).toBe(7);
    expect(decoded.always).toBe(2);
  });
});

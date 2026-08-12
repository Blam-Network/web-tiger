import { bitstream } from "@blamnetwork/blf";

const { c_bitstream_reader, c_bitstream_writer, e_bitstream_byte_order } =
  bitstream;

const BE = e_bitstream_byte_order._bitstream_byte_order_big_endian;

/**
 * Thin RSAT-facing wrapper over blf's Halo/Blam bitstream (BE, MSB→LSB).
 * Destiny RSAT uses the same packing convention.
 */
export class BitWriter {
  private readonly inner: bitstream.c_bitstream_writer;

  constructor(capacityBytes = 4096) {
    this.inner = c_bitstream_writer.new(capacityBytes, BE);
    this.inner.begin_writing();
  }

  write(value: number | bigint, width: number): void {
    if (width <= 0 || width > 64) {
      throw new Error(`invalid bit width ${width}`);
    }
    if (width <= 32) {
      const n =
        typeof value === "bigint" ? Number(value & 0xffffffffn) : value >>> 0;
      this.inner.write_integer(n, width);
      return;
    }
    const v = typeof value === "bigint" ? value : BigInt(value >>> 0);
    this.inner.write_qword(v, width);
  }

  writeBit(bit: number | boolean): void {
    this.inner.write_bool(!!bit);
  }

  get bitCount(): number {
    const [byte, bit] = this.inner.get_current_offset();
    return byte * 8 + bit;
  }

  /** Pad to whole bytes and return the written buffer. */
  finish(): Buffer {
    this.inner.finish_writing();
    return Buffer.from(this.inner.get_data());
  }

  /** Underlying blf writer (already in writing state until {@link finish}). */
  get native(): bitstream.c_bitstream_writer {
    return this.inner;
  }
}

/** Thin RSAT-facing wrapper over blf's bitstream reader (BE, MSB→LSB). */
export class BitReader {
  private readonly inner: bitstream.c_bitstream_reader;
  private readonly byteLength: number;

  constructor(bytes: Buffer | Uint8Array) {
    this.byteLength = bytes.length;
    this.inner = c_bitstream_reader.new(bytes, BE);
    this.inner.begin_reading();
  }

  get bitPos(): number {
    const [byte, bit] = this.inner.get_current_offset();
    return byte * 8 + bit;
  }

  get bitLength(): number {
    return this.byteLength * 8;
  }

  readBit(): number {
    return this.inner.read_bool("bit") ? 1 : 0;
  }

  read(width: number): bigint {
    if (width <= 0 || width > 64) {
      throw new Error(`invalid bit width ${width}`);
    }
    if (width <= 32) {
      return BigInt(this.inner.read_integer("int", width) >>> 0);
    }
    return this.inner.read_qword(width);
  }

  readNumber(width: number): number {
    if (width <= 0 || width > 32) {
      throw new Error(`invalid number bit width ${width}`);
    }
    return this.inner.read_integer("int", width) >>> 0;
  }

  /** Underlying blf reader. */
  get native(): bitstream.c_bitstream_reader {
    return this.inner;
  }
}

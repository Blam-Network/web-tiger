import type * as net from "node:net";
import type ILogger from "../ILogger";
import {
  CLIENT_HEADER_MAGIC,
  DEFAULT_SERVER_MAX_MSG,
  FAKE_CONNECTION_ID,
  MSG_CLIENT_INIT_BLOB,
  MSG_LSG_CONNECTION_ID,
} from "./constants";
import { dispatchLobbyService } from "./matchmaking";
import { buildConnectionIdFrame } from "./typed-buffer";
import { hexPreview, readI32LE, writeI32LE } from "./util";

/**
 * Destiny (Xbox 360 DW3) LSG / bdLobbyConnection session.
 *
 * Destiny does not use later CoD s1x AB81/AB82/AB85 crypto. Flow:
 *   1. Client sends 8-byte "200 header": u32le magic=200 | u32le maxRecvBuffer
 *   2. Framed messages: u32le size | u8 encryptFlag | body[size-1]
 *   3. body[0] is lobby control type or bd* service id
 */
export class LobbySession {
  private buffer = Buffer.alloc(0);
  private gotClientHeader = false;
  private clientMaxMsg = DEFAULT_SERVER_MAX_MSG;
  private sentConnectionId = false;
  private readonly remote: string;

  constructor(
    private readonly socket: net.Socket,
    private readonly logger: ILogger
  ) {
    this.remote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.logger.log(`Lobby connect from ${this.remote}`);

    socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.buffer = this.drain();
    });
    socket.on("error", (err) => {
      this.logger.warn(`Lobby socket error (${this.remote}): ${err.message}`);
    });
    socket.on("close", () => {
      this.logger.log(`Lobby disconnect ${this.remote}`);
    });
  }

  private drain(): Buffer {
    let buffer = this.buffer;

    if (!this.gotClientHeader) {
      if (buffer.length < 8) {
        return buffer;
      }

      const magic = buffer.readUInt32LE(0);
      const maxMsg = buffer.readUInt32LE(4);
      buffer = buffer.subarray(8);

      if (magic === CLIENT_HEADER_MAGIC) {
        this.gotClientHeader = true;
        this.clientMaxMsg = maxMsg || DEFAULT_SERVER_MAX_MSG;
        this.logger.log(
          `[${this.remote}] 200 client header ok (maxMsg=${this.clientMaxMsg})`
        );
        this.sendConnectionId();
      } else {
        this.logger.warn(
          `[${this.remote}] expected 200 client header, got magic=${magic} (0x${magic.toString(16)})`
        );
        buffer = Buffer.concat([writeI32LE(magic), writeI32LE(maxMsg), buffer]);
        this.gotClientHeader = true;
      }
    }

    while (buffer.length >= 4) {
      const size = readI32LE(buffer, 0);

      if (size <= 0) {
        this.socket.write(Buffer.from([0, 0, 0, 0]));
        buffer = buffer.subarray(4);
        continue;
      }

      if (size === CLIENT_HEADER_MAGIC && !this.sentConnectionId) {
        this.logger.warn(
          `[${this.remote}] saw size==200 mid-stream — treating as late client header`
        );
        if (buffer.length < 8) {
          return buffer;
        }
        this.clientMaxMsg = buffer.readUInt32LE(4) || DEFAULT_SERVER_MAX_MSG;
        buffer = buffer.subarray(8);
        this.sendConnectionId();
        continue;
      }

      if (size > 0x100000) {
        this.logger.warn(
          `[${this.remote}] absurd frame size ${size} — dropping connection`
        );
        this.socket.destroy();
        return Buffer.alloc(0);
      }

      const total = 4 + size;
      if (buffer.length < total) {
        return buffer;
      }

      const payload = buffer.subarray(4, total);
      buffer = buffer.subarray(total);
      this.handleFrame(size, payload);
    }

    return buffer;
  }

  private sendConnectionId(): void {
    if (this.sentConnectionId) {
      return;
    }
    this.sentConnectionId = true;
    const frame = buildConnectionIdFrame(FAKE_CONNECTION_ID);
    this.socket.write(frame);
    this.logger.log(
      `[${this.remote}] LSG connection ID (type 4) sent id=0x${FAKE_CONNECTION_ID.toString(16)} frame=${hexPreview(frame)}`
    );
  }

  private handleFrame(size: number, payload: Buffer): void {
    if (payload.length < 1) {
      this.logger.warn(`[${this.remote}] empty frame size=${size}`);
      return;
    }

    const enc = payload[0]!;
    const body = payload.subarray(1);

    this.logger.log(
      `[${this.remote}] frame size=${size} enc=${enc} body=${hexPreview(body, 96)}`
    );

    if (enc === 1 || enc === 2) {
      this.logger.warn(
        `[${this.remote}] encrypted frame (flag=${enc}) not implemented`
      );
      return;
    }

    if (body.length < 1) {
      this.logger.warn(`[${this.remote}] frame missing message type`);
      return;
    }

    const msgType = body[0]!;
    const rest = body.subarray(1);

    switch (msgType) {
      case MSG_CLIENT_INIT_BLOB:
        this.logger.log(
          `[${this.remote}] client init blob (type 7) len=${rest.length} data=${hexPreview(rest, 48)}`
        );
        this.sendConnectionId();
        break;

      case MSG_LSG_CONNECTION_ID:
        this.logger.log(
          `[${this.remote}] unexpected client connection-id echo? ${hexPreview(rest)}`
        );
        break;

      default:
        if (msgType >= 8) {
          dispatchLobbyService(
            this.socket,
            this.remote,
            msgType,
            rest,
            this.logger
          );
        } else {
          this.logger.warn(
            `[${this.remote}] unhandled LSG message type=${msgType} rest=${hexPreview(rest)}`
          );
        }
        break;
    }
  }
}

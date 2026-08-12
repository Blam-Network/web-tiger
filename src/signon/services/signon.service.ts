/**
 * @see Guest request builder sub_828B94E0 (nanopb table unk_82037250)
 * @see Guest response parser sub_828B7FC0 ("Processing signon success ticket from server")
 */

import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { Inject, Injectable } from "@nestjs/common";
import {
  type SignonRequest,
  SignonRequestSchema,
  SignonResponseSchema,
} from "../../generated/signon_pb";
import type ILogger from "../../ILogger";
import { ILoggerSymbol } from "../../ILogger";
import {
  BAP_SECURITY_TOKEN,
  BAP_SESSION_KEY_AES,
  BAP_SESSION_KEY_HMAC,
  BAP_SIGNON_IP,
  BAP_SIGNON_PORT,
} from "../config";

@Injectable()
export class SignonService {
  constructor(@Inject(ILoggerSymbol) private readonly logger: ILogger) {}

  parseSignonRequest(body: Buffer): SignonRequest | undefined {
    if (body.length === 0) {
      this.logger.warn("Signon request has empty body");
      return;
    }

    try {
      const request = fromBinary(SignonRequestSchema, body);
      return request;
    } catch (error) {
      this.logger.error(
        `Failed to decode SignonRequest: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
  }

  buildSuccessSignonResponse(opts?: {
    bapIp?: string;
    bapPort?: number;
  }): Buffer {
    const bapIp = opts?.bapIp ?? BAP_SIGNON_IP;
    const bapPort = opts?.bapPort ?? BAP_SIGNON_PORT;

    const message = create(SignonResponseSchema, {
      type: 0,
      successTicket: {
        id: new Uint8Array(16),
        sessionKeyAes: BAP_SESSION_KEY_AES,
        sessionKeyHmac: BAP_SESSION_KEY_HMAC,
        securityToken: BAP_SECURITY_TOKEN,
        reserved5: 0n,
        bapIpv4: this.ipv4StringToUint32(bapIp),
        bapPort,
      },
    });

    return Buffer.from(toBinary(SignonResponseSchema, message));
  }

  // If we need to do this anywhere else, extract out as a helper.
  private ipv4StringToUint32(ip: string): number {
    const parts = ip.split(".").map((p) => Number(p));
    if (
      parts.length !== 4 ||
      parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
    ) {
      throw new Error(`Invalid IPv4 address: ${ip}`);
    }
    return (
      ((parts[3] << 24) | (parts[2] << 16) | (parts[1] << 8) | parts[0]) >>> 0
    );
  }
}

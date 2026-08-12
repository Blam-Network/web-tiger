import type * as net from "node:net";
import type ILogger from "../ILogger";
import {
  FAKE_CONNECTION_ID,
  FAKE_DW_SESSION_ID,
  MM_CREATE_SESSION,
  MM_DELETE_SESSION,
  MM_FIND_SESSIONS,
  MM_GET_PERFORMANCE,
  MM_SUBMIT_PERFORMANCE,
  MM_UPDATE_SESSION,
  SVC_BD_MATCHMAKING,
} from "./constants";
import {
  buildTaskReplyFrame,
  peekTypedByte,
  readTypedByte,
  readTypedU32,
  readTypedU64,
  writeTypedBlob,
  writeTypedI64,
  writeTypedU64,
} from "./typed-buffer";
import { hexPreview } from "./util";

let nextTransactionId = 1n;

/**
 * bdMatchMaking (service 21). Wire: typed-byte taskId + typed params.
 * Activity session creation blocks on createSession until a TASK_REPLY arrives.
 */
export function handleMatchMaking(
  socket: net.Socket,
  remote: string,
  rest: Buffer,
  logger: ILogger,
  sendTaskReply: (taskId: number, results: Buffer[]) => void
): void {
  const parsed = readTypedByte(rest);
  if (!parsed) {
    logger.warn(
      `[${remote}] bdMatchMaking missing typed task id rest=${hexPreview(rest)}`
    );
    return;
  }

  const { value: taskId, next } = parsed;
  logger.log(
    `[${remote}] bdMatchMaking task=${taskId} params=${hexPreview(next, 64)}`
  );

  switch (taskId) {
    case MM_CREATE_SESSION: {
      const sessionId = FAKE_DW_SESSION_ID;
      const idBytes = Buffer.alloc(8);
      idBytes.writeBigUInt64LE(sessionId, 0);
      sendTaskReply(taskId, [writeTypedBlob(idBytes)]);
      logger.log(
        `[${remote}] bdMatchMaking createSession → id=0x${sessionId.toString(16)}`
      );
      break;
    }

    case MM_GET_PERFORMANCE: {
      const results: Buffer[] = [];
      let cursor = next;
      const gameType = readTypedU32(cursor);
      if (gameType) {
        cursor = gameType.next;
        while (cursor.length > 0) {
          const uid = readTypedU64(cursor);
          if (!uid) {
            break;
          }
          cursor = uid.next;
          results.push(
            Buffer.concat([writeTypedU64(uid.value), writeTypedI64(10n)])
          );
        }
        logger.log(
          `[${remote}] bdMatchMaking getPerformance gameType=0x${gameType.value.toString(16)} users=${results.length}`
        );
      }
      sendTaskReply(taskId, results);
      break;
    }

    case MM_UPDATE_SESSION:
    case MM_DELETE_SESSION:
    case MM_SUBMIT_PERFORMANCE:
      sendTaskReply(taskId, []);
      break;

    case MM_FIND_SESSIONS:
      // Solo Nest: no foreign public sessions. Empty results are correct.
      // GAH / PAH spin hooks can plug in here later.
      sendTaskReply(taskId, []);
      logger.log(`[${remote}] bdMatchMaking findSessions → 0 sessions`);
      break;

    default:
      logger.warn(
        `[${remote}] bdMatchMaking unhandled task=${taskId} — empty success`
      );
      sendTaskReply(taskId, []);
      break;
  }
}

export function sendLobbyTaskReply(
  socket: net.Socket,
  remote: string,
  taskId: number,
  resultObjects: Buffer[],
  logger: ILogger
): void {
  const txn = nextTransactionId++;
  const frame = buildTaskReplyFrame(txn, taskId, resultObjects);
  socket.write(frame);
  logger.log(
    `[${remote}] TASK_REPLY task=${taskId} txn=${txn} results=${resultObjects.length} frame=${hexPreview(frame, 48)}`
  );
}

export function dispatchLobbyService(
  socket: net.Socket,
  remote: string,
  serviceId: number,
  rest: Buffer,
  logger: ILogger
): void {
  const reply = (taskId: number, results: Buffer[]) =>
    sendLobbyTaskReply(socket, remote, taskId, results, logger);

  if (serviceId === SVC_BD_MATCHMAKING) {
    handleMatchMaking(socket, remote, rest, logger, reply);
    return;
  }

  const taskId = peekTypedByte(rest);
  logger.warn(
    `[${remote}] stub empty TASK_REPLY for service=${serviceId} task=${taskId ?? "?"}`
  );
  reply(taskId ?? 0, []);
}

export { FAKE_CONNECTION_ID };

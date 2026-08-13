import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  e_datamine_parameter_type,
  get_formatted_event_string,
  read_datamine_file,
  type s_data_mine_header,
  type s_datamine_event,
  type s_datamine_file,
} from "@blamnetwork/blf";
import { Inject, Injectable, Optional } from "@nestjs/common";
import type { DatamineParameterType } from "@prisma/client";
import * as yauzl from "yauzl";
import type ILogger from "../../ILogger";
import { ILoggerSymbol } from "../../ILogger";
import { DATAMINE_DIR } from "../constants";
import { BnetPrismaToken, type PrismaService } from "../prisma.service";

const DATAMINE_ZIP_ENTRY = "compressed.dat";

/** Windows FILETIME (100ns since 1601-01-01) → Date. */
const FILETIME_EPOCH_DIFF_MS = 11_644_473_600_000n;

const PRIORITY_MAP: Record<number, string> = {
  0: "verbose",
  1: "status ",
  2: "message",
  3: "WARNING",
  4: "-ERROR-",
  5: "-CRITICAL-",
};

function fileTimeToDate(filetime: bigint): Date {
  return new Date(Number(filetime / 10_000n - FILETIME_EPOCH_DIFF_MS));
}

/** MM.DD.YY HH:mm:ss.SSS — matches web_private datamine log download. */
function formatEventDateTime(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${month}.${day}.${year} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function formatEventIndex(index: number): string {
  return String(index).padStart(7, "0");
}

function getPriorityString(priority: number): string | undefined {
  return PRIORITY_MAP[priority];
}

function headerTitle(header: s_data_mine_header): string {
  if ("title" in header && header.title) {
    return header.title;
  }

  if ("application_name" in header && header.application_name && header.application_name.startsWith("tiger_")) {
    return "tiger";
  }
  return "unknown";
}

/** Prefer header filetime; if unset (0), fall back to earliest event. */
function resolveSessionStartDate(datamine: s_datamine_file): Date {
  if (datamine.header.session_start_date !== 0n) {
    return fileTimeToDate(datamine.header.session_start_date);
  }
  let earliest: bigint | undefined;
  for (const event of datamine.events) {
    if (event.header.event_date === 0n) {
      continue;
    }
    if (earliest === undefined || event.header.event_date < earliest) {
      earliest = event.header.event_date;
    }
  }
  return earliest !== undefined ? fileTimeToDate(earliest) : fileTimeToDate(0n);
}

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 180);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function formatDatamineLogHeader(header: s_data_mine_header): string {
  const banner =
    "============================================================================================\n";
  return `${banner}blamnet datamine ${headerTitle(header)} ${header.build_string} \n${banner}\n`;
}

function formatDatamineLogEvents(events: s_datamine_event[]): string {
  const ordered = [...events].sort(
    (a, b) => a.header.event_index - b.header.event_index
  );
  let log = "";
  for (const event of ordered) {
    log += formatDatamineLogLine(event);
  }
  return log;
}

function formatDatamineLogLine(event: s_datamine_event): string {
  const dateStr = formatEventDateTime(fileTimeToDate(event.header.event_date));
  const indexStr = formatEventIndex(event.header.event_index);
  // v1/v2: priority is on the event. v3: severity lives on the definition
  // (byte after format_major); occurrence only carries definition_id.
  const priorityStr = getPriorityString(event.header.priority);
  const message =
    get_formatted_event_string(event) ??
    `<invalid message string: ${event.header.event_name}>`;
  const priorityPart = priorityStr ? ` ${priorityStr}` : "";
  return `${dateStr} ${indexStr}${priorityPart} ${message}\n`;
}

function convertParameterType(
  blfType: e_datamine_parameter_type
): DatamineParameterType {
  switch (blfType) {
    case e_datamine_parameter_type._datamine_parameter_type_long:
      return "LONG";
    case e_datamine_parameter_type._datamine_parameter_type_int64:
      return "INT64";
    case e_datamine_parameter_type._datamine_parameter_type_float:
      return "FLOAT";
    case e_datamine_parameter_type._datamine_parameter_type_string:
      return "STRING";
    default:
      throw new Error(`Unknown parameter type: ${blfType}`);
  }
}

function extractMultipartFile(body: Buffer): Buffer | undefined {
  const asAscii = body.toString("latin1");
  const boundaryMatch = asAscii.match(/^--([^\r\n]+)/);
  if (!boundaryMatch) {
    // Raw zip / compressed.dat (tests / manual drops)
    if (body.length >= 2 && body[0] === 0x50 && body[1] === 0x4b) {
      return body;
    }
    if (body.length >= 2 && body[0] === 0xff && body[1] === 0xfe) {
      return body;
    }
    return undefined;
  }

  const boundary = boundaryMatch[1];
  const parts = asAscii.split(`--${boundary}`);
  for (const part of parts) {
    if (!/name="upload"/i.test(part)) {
      continue;
    }
    const sep = part.indexOf("\r\n\r\n");
    if (sep < 0) {
      continue;
    }
    let payload = part.slice(sep + 4);
    if (payload.endsWith("\r\n")) {
      payload = payload.slice(0, -2);
    }
    return Buffer.from(payload, "latin1");
  }
  return undefined;
}

function openZipEntry(buffer: Buffer, fileName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("failed to open zip"));
        return;
      }
      let found = false;
      zipfile.on("entry", (entry) => {
        if (entry.fileName !== fileName) {
          zipfile.readEntry();
          return;
        }
        found = true;
        zipfile.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            reject(streamErr ?? new Error("failed to read zip entry"));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => resolve(Buffer.concat(chunks)));
          stream.on("error", reject);
        });
      });
      zipfile.on("end", () => {
        if (!found) {
          reject(new Error(`zip entry missing: ${fileName}`));
        }
      });
      zipfile.on("error", reject);
      zipfile.readEntry();
    });
  });
}

async function parseTicketDropBody(
  body: Buffer
): Promise<s_datamine_file | undefined> {
  const upload = extractMultipartFile(body);
  if (!upload) {
    return undefined;
  }

  // Multipart usually wraps a ZIP; compressed.dat may also arrive bare.
  let datamineBuf: Buffer;
  if (upload.length >= 2 && upload[0] === 0xff && upload[1] === 0xfe) {
    datamineBuf = upload;
  } else {
    try {
      datamineBuf = await openZipEntry(upload, DATAMINE_ZIP_ENTRY);
    } catch {
      return undefined;
    }
  }

  return read_datamine_file(datamineBuf);
}

@Injectable()
export class DatamineService {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    @Optional()
    @Inject(BnetPrismaToken)
    private readonly prisma: PrismaService | null
  ) {}

  async absorbTicketDrop(
    body: Buffer,
    meta?: { method?: string; host?: string }
  ): Promise<{ ok: true; bytes: number; path?: string; events?: number }> {
    const method = meta?.method ?? "PUT";
    const host = meta?.host ? ` host=${meta.host}` : "";

    let events: number | undefined;
    let path: string | undefined;
    try {
      const datamine = await parseTicketDropBody(body);
      if (!datamine) {
        this.logger.warn(
          `${method} /ticket_drop parse failed (${body.length}B)${host}`
        );
      } else {
        events = datamine.events.length;
        if (this.prisma) {
          await this.pushToDatabase(datamine);
        } else {
          path = this.saveParsedTxt(datamine);
        }
        this.logger.log(
          `Datamine upload received for session ${datamine.header.sessionid} (${events} events)`
        );
      }
    } catch (error) {
      this.logger.error(
        `${method} /ticket_drop parse error: ${error instanceof Error ? error.message : error}`
      );
    }

    return { ok: true, bytes: body.length, path, events };
  }

  private async pushToDatabase(datamine: s_datamine_file): Promise<void> {
    if (!this.prisma) {
      return;
    }

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const sessionStart = resolveSessionStartDate(datamine);
          let session = await tx.datamine_session.findUnique({
            where: {
              sessionid_session_start_date: {
                sessionid: datamine.header.sessionid,
                session_start_date: sessionStart,
              },
            },
          });

          if (!session) {
            session = await tx.datamine_session.create({
              data: {
                sessionid: truncate(datamine.header.sessionid, 128),
                build_string: truncate(datamine.header.build_string, 32),
                build_number: datamine.header.build_number,
                systemid: truncate(datamine.header.systemid, 160),
                title: truncate(headerTitle(datamine.header), 32),
                session_start_date: sessionStart,
              },
            });
          }

          const eventsData = datamine.events.map((event) => ({
            event_index: event.header.event_index,
            session_id: session.id,
            priority: event.header.priority,
            game_instance: event.header.game_info.game_instance.toString(),
            map: truncate(event.header.game_info.map, 260),
            event_date: fileTimeToDate(event.header.event_date),
            message: truncate(
              get_formatted_event_string(event) ??
                `<invalid message string: ${event.header.event_name}>`,
              2048
            ),
            categories: event.categories,
          }));

          await tx.datamine_event.createMany({
            data: eventsData,
            skipDuplicates: true,
          });

          const eventIndices = eventsData.map((e) => e.event_index);
          if (eventIndices.length > 0) {
            await tx.datamine_event_parameter.deleteMany({
              where: {
                session_id: session.id,
                event_index: { in: eventIndices },
              },
            });
          }

          const allParameters = datamine.events.flatMap((event) =>
            event.parameters
              .filter((parameter) => parameter.name)
              .map((parameter) => {
                let numericValue: string | undefined;
                let stringValue: string;

                switch (parameter.parameter_type) {
                  case e_datamine_parameter_type._datamine_parameter_type_long:
                    if (parameter.value_long === undefined) {
                      return null;
                    }
                    numericValue = parameter.value_long.toString();
                    stringValue = parameter.value_long.toString();
                    break;
                  case e_datamine_parameter_type._datamine_parameter_type_int64:
                    if (parameter.value_int64 === undefined) {
                      return null;
                    }
                    numericValue = parameter.value_int64.toString();
                    stringValue = parameter.value_int64.toString();
                    break;
                  case e_datamine_parameter_type._datamine_parameter_type_float:
                    if (parameter.value_float === undefined) {
                      return null;
                    }
                    numericValue = parameter.value_float.toString();
                    stringValue = parameter.value_float.toString();
                    break;
                  case e_datamine_parameter_type._datamine_parameter_type_string:
                    if (parameter.value_string === undefined) {
                      return null;
                    }
                    stringValue = parameter.value_string.string;
                    break;
                  default:
                    return null;
                }

                return {
                  event_index: event.header.event_index,
                  session_id: session.id,
                  key: truncate(parameter.name, 128),
                  type: convertParameterType(parameter.parameter_type),
                  numeric_value: numericValue,
                  string_value: stringValue,
                };
              })
              .filter((param): param is NonNullable<typeof param> => param !== null)
          );

          if (allParameters.length > 0) {
            await tx.datamine_event_parameter.createMany({
              data: allParameters,
            });
          }
        },
        {
          maxWait: 10_000,
          timeout: 30_000,
        }
      );
    } catch (error) {
      this.logger.error(
        `Datamine DB push failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  private saveParsedTxt(datamine: s_datamine_file): string {
    const dir = DATAMINE_DIR;
    mkdirSync(dir, { recursive: true });
    const sessionPart = sanitizeFilename(
      datamine.header.sessionid || "session"
    );
    const file = join(dir, `${sessionPart}.txt`);
    const events = formatDatamineLogEvents(datamine.events);
    if (existsSync(file)) {
      appendFileSync(file, events);
    } else {
      writeFileSync(file, formatDatamineLogHeader(datamine.header) + events);
    }
    return file;
  }
}

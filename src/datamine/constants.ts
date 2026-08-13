import { join } from "node:path";

export const DATAMINE_HTTP_PORTS_DEFAULT = [32_556] as const;

/** On-disk formatted datamine .txt logs. */
export const DATAMINE_DIR = join(process.cwd(), "datamine");

export function resolveDatamineHttpPorts(): number[] {
  const raw = process.env.DATAMINE_HTTP_PORTS?.trim();
  if (!raw) {
    return [...DATAMINE_HTTP_PORTS_DEFAULT];
  }
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

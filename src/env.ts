import { existsSync } from "node:fs";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";

/** Load `.env` from cwd and package roots (src/ or dist/). */
export function loadWebTigerEnv(): void {
  const candidates = [
    join(process.cwd(), ".env"),
    join(__dirname, "..", ".env"),
    join(__dirname, "..", "..", ".env"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path, override: false });
    }
  }
}

export function resolveBnetDatabaseUrl(): string | undefined {
  loadWebTigerEnv();
  const raw = process.env.BNET_DATABASE?.trim();
  return raw || undefined;
}

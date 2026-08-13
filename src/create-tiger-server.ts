import { createBapServer } from "./bap/init";
import { createDatamineServer } from "./datamine/init";
import { createDemonwareServer } from "./demonware/init";
import { loadWebTigerEnv } from "./env";
import { createSignonServer } from "./signon/init";

export async function createTigerServer(opts?: {
  hostname?: string;
}): Promise<void> {
  loadWebTigerEnv();
  await createSignonServer({ hostname: opts?.hostname });
  await createDatamineServer({ hostname: opts?.hostname });
  await createBapServer({ hostname: opts?.hostname });
  await createDemonwareServer({ hostname: opts?.hostname });
}

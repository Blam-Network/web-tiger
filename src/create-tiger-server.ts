import { createBapServer } from "./bap/init";
import { createDemonwareServer } from "./demonware/init";
import { createSignonServer } from "./signon/init";

export async function createTigerServer(opts?: {
  hostname?: string;
}): Promise<void> {
  await createSignonServer({ hostname: opts?.hostname });
  await createBapServer({ hostname: opts?.hostname });
  await createDemonwareServer({ hostname: opts?.hostname });
}

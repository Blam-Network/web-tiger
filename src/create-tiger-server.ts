import { createBapServer } from "./bap/init";
import { createSignonServer } from "./signon/init";

export async function createTigerServer(opts?: {
  hostname?: string;
}): Promise<void> {
  await createSignonServer({ hostname: opts?.hostname });
  await createBapServer({ hostname: opts?.hostname });
}

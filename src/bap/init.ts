import type * as net from "node:net";
import { NestFactory } from "@nestjs/core";
import { BapModule } from "./bap.module";
import { BapServerService } from "./bap-server.service";
import { BAP_SIGNON_PORT } from "./config";

export async function createBapServer(opts?: {
  port?: number;
  hostname?: string;
}): Promise<net.Server> {
  const app = await NestFactory.createApplicationContext(BapModule, {
    logger: false,
  });

  const service = app.get(BapServerService);
  return service.listen({
    port: opts?.port ?? BAP_SIGNON_PORT,
    hostname: opts?.hostname,
  });
}

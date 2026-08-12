import type * as net from "node:net";
import { NestFactory } from "@nestjs/core";
import { resolveDemonwareLobbyPorts } from "./config";
import { DemonwareModule } from "./demonware.module";
import { DemonwareServerService } from "./demonware-server.service";

export async function createDemonwareServer(opts?: {
  ports?: number[];
  hostname?: string;
}): Promise<net.Server[]> {
  const app = await NestFactory.createApplicationContext(DemonwareModule, {
    logger: false,
  });

  const service = app.get(DemonwareServerService);
  return service.listen({
    ports: opts?.ports ?? resolveDemonwareLobbyPorts(),
    hostname: opts?.hostname,
  });
}

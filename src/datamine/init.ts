import * as http from "node:http";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import express from "express";
import { loadWebTigerEnv } from "../env";
import type ILogger from "../ILogger";
import { ILoggerSymbol } from "../ILogger";
import { ShutdownObserver } from "../ShutdownObserver";
import { resolveDatamineHttpPorts } from "./constants";
import { DatamineModule } from "./datamine.module";
import { BnetPrismaToken } from "./prisma.service";

export async function createDatamineServer(opts?: {
  ports?: number[];
  hostname?: string;
}): Promise<http.Server[]> {
  loadWebTigerEnv();
  const ports = opts?.ports ?? resolveDatamineHttpPorts();
  const hostname = opts?.hostname ?? process.env.HOSTNAME;

  const server = express();
  // Client PUTs binary datamine blobs; keep the body as raw bytes.
  server.use(express.raw({ type: () => true, limit: "32mb" }));

  const app = await NestFactory.create(
    DatamineModule,
    new ExpressAdapter(server),
    { bodyParser: false }
  );

  const config = new DocumentBuilder()
    .setTitle("BNET - Tiger Datamine / Ticket Server")
    .setVersion("36735.13.12.02.1953.alpha")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  app.enableCors();
  await app.init();

  const shutdownObserver = app.get(ShutdownObserver);
  const httpServers = ports.map((port) => {
    const httpServer = http.createServer(server).listen(port, hostname);
    shutdownObserver.addHttpServer(httpServer);
    return httpServer;
  });

  const logger = app.get<ILogger>(ILoggerSymbol);
  let usingDatabase = false;
  try {
    usingDatabase = Boolean(app.get(BnetPrismaToken));
  } catch {
    usingDatabase = false;
  }
  logger.log(
    usingDatabase
      ? "BNET_DATABASE set — datamine uploads go to Postgres"
      : "BNET_DATABASE unset — datamine uploads saved under ./datamine"
  );
  logger.log(`Listening on ports: ${ports.toString()}`);

  return httpServers;
}

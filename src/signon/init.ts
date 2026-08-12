import * as http from "node:http";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import express from "express";
import type ILogger from "../ILogger";
import { ILoggerSymbol } from "../ILogger";
import { ShutdownObserver } from "../ShutdownObserver";
import { resolveSignonHttpPorts } from "./constants";
import { SignonModule } from "./signon.module";

export async function createSignonServer(opts?: {
  ports?: number[];
  hostname?: string;
}): Promise<http.Server[]> {
  const ports = opts?.ports ?? resolveSignonHttpPorts();
  const hostname = opts?.hostname ?? process.env.HOSTNAME;

  const server = express();
  // XHTTP GET /signon still carries a protobuf body; keep it as raw bytes.
  server.use(express.raw({ type: () => true, limit: "1mb" }));

  const app = await NestFactory.create(
    SignonModule,
    new ExpressAdapter(server),
    { bodyParser: false }
  );

  const config = new DocumentBuilder()
    .setTitle("BNET - Tiger Sign-on Server")
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
  logger.log(`Listening on ports: ${ports.toString()}`);

  return httpServers;
}

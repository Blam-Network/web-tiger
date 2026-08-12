import * as net from "node:net";
import { Inject, Injectable } from "@nestjs/common";
import type ILogger from "../ILogger";
import { ILoggerSymbol } from "../ILogger";
import { ShutdownObserver } from "../ShutdownObserver";
import { DEMONWARE_BIND_HOST, resolveDemonwareLobbyPorts } from "./config";
import { LobbySession } from "./lobby-session";

@Injectable()
export class DemonwareServerService {
  private readonly servers: net.Server[] = [];

  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly shutdownObserver: ShutdownObserver
  ) {}

  listen(opts?: {
    ports?: number[];
    hostname?: string;
  }): Promise<net.Server[]> {
    const ports = opts?.ports ?? resolveDemonwareLobbyPorts();
    const hostname = opts?.hostname ?? DEMONWARE_BIND_HOST;

    return Promise.all(ports.map((port) => this.listenOne(port, hostname)));
  }

  private listenOne(port: number, hostname: string): Promise<net.Server> {
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        new LobbySession(socket, this.logger);
      });

      server.once("error", reject);
      server.listen(port, hostname, () => {
        this.servers.push(server);
        this.shutdownObserver.addTcpServer(server);
        this.logger.log(`Demonware lobby TCP listening on ${hostname}:${port}`);
        resolve(server);
      });
    });
  }
}

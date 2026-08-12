import type * as http from "node:http";
import type * as net from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";

@Injectable()
export class ShutdownObserver implements OnApplicationShutdown {
  private readonly httpServers: http.Server[] = [];
  private readonly tcpServers: net.Server[] = [];

  public addHttpServer(server: http.Server): void {
    this.httpServers.push(server);
  }

  public addTcpServer(server: net.Server): void {
    this.tcpServers.push(server);
  }

  public async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      ...this.httpServers.map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          })
      ),
      ...this.tcpServers.map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          })
      ),
    ]);
  }
}

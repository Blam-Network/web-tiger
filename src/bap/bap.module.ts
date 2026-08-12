import { Module } from "@nestjs/common";
import { ILoggerSymbol } from "../ILogger";
import { ShutdownObserver } from "../ShutdownObserver";
import { loggerWithPrefix } from "../utils/logger";
import { BapServerService } from "./bap-server.service";

@Module({
  providers: [BapServerService, loggerWithPrefix("BAP"), ShutdownObserver],
  exports: [BapServerService, ILoggerSymbol, ShutdownObserver],
})
export class BapModule {}

import { Module } from "@nestjs/common";
import { ILoggerSymbol } from "../ILogger";
import { ShutdownObserver } from "../ShutdownObserver";
import { loggerWithPrefix } from "../utils/logger";
import { DemonwareServerService } from "./demonware-server.service";

@Module({
  providers: [
    DemonwareServerService,
    loggerWithPrefix("Demonware"),
    ShutdownObserver,
  ],
  exports: [DemonwareServerService, ILoggerSymbol, ShutdownObserver],
})
export class DemonwareModule {}

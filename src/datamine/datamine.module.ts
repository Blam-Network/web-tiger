import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { resolveBnetDatabaseUrl } from "../env";
import { ILoggerSymbol } from "../ILogger";
import { AppLoggerMiddleware } from "../middleware/AppLoggerMiddleware";
import { ShutdownObserver } from "../ShutdownObserver";
import { loggerWithPrefix } from "../utils/logger";
import { DatamineController } from "./controllers/datamine.controller";
import { BnetPrismaToken, PrismaService } from "./prisma.service";
import { DatamineService } from "./services/datamine.service";

function createPrismaService(): PrismaService | null {
  if (!resolveBnetDatabaseUrl()) {
    return null;
  }
  return new PrismaService();
}

@Module({
  controllers: [DatamineController],
  providers: [
    {
      provide: BnetPrismaToken,
      useFactory: createPrismaService,
    },
    DatamineService,
    loggerWithPrefix("Datamine"),
    ShutdownObserver,
  ],
  exports: [DatamineService, ILoggerSymbol, ShutdownObserver],
})
export class DatamineModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppLoggerMiddleware).forRoutes("*");
  }
}

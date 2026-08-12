import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { ILoggerSymbol } from "../ILogger";
import { AppLoggerMiddleware } from "../middleware/AppLoggerMiddleware";
import { ShutdownObserver } from "../ShutdownObserver";
import { loggerWithPrefix } from "../utils/logger";
import { SignonController } from "./controllers/signon.controller";
import { SignonService } from "./services/signon.service";

@Module({
  controllers: [SignonController],
  providers: [SignonService, loggerWithPrefix("SignOn"), ShutdownObserver],
  exports: [SignonService, ILoggerSymbol, ShutdownObserver],
})
export class SignonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppLoggerMiddleware).forRoutes("*");
  }
}

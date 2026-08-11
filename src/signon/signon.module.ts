import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { SignonController } from './controllers/signon.controller';
import { SignonService } from './services/signon.service';
import { loggerWithPrefix } from '../utils/logger';
import { ILoggerSymbol } from '../ILogger';
import { ShutdownObserver } from '../ShutdownObserver';
import { AppLoggerMiddleware } from '../middleware/AppLoggerMiddleware';

@Module({
  controllers: [SignonController],
  providers: [SignonService, loggerWithPrefix('SignOn'), ShutdownObserver],
  exports: [SignonService, ILoggerSymbol, ShutdownObserver],
})
export class SignonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppLoggerMiddleware).forRoutes('*');
  }
}

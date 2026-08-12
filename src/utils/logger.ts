import { ConsoleLogger } from "@nestjs/common";
import { ILoggerSymbol } from "../ILogger";

export const loggerWithPrefix = (prefix: string) => ({
  provide: ILoggerSymbol,
  useFactory: () => {
    const logger = new ConsoleLogger();
    logger.setContext(prefix);
    return logger;
  },
});

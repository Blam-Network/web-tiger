export default interface ILogger {
  debug(debug: any): void;
  error(error: any): void;
  log(info: any): void;
  warn(info: any): void;
}

export const ILoggerSymbol = Symbol("ILogger");

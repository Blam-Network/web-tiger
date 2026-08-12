import { Injectable, Logger, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class AppLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method } = request;
    const userAgent = request.get("user-agent") || "";

    response.on("close", () => {
      const headers = JSON.stringify(request.headers);

      this.logger.log(
        `${method} ${request.originalUrl} ${response.statusCode} - ${userAgent} ${ip} ${headers}`
      );
    });

    next();
  }
}

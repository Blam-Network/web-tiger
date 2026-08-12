import { Module } from "@nestjs/common";
import { BapModule } from "./bap/bap.module";
import { SignonModule } from "./signon/signon.module";

@Module({
  imports: [SignonModule, BapModule],
  exports: [SignonModule, BapModule],
})
export class TigerModule {}

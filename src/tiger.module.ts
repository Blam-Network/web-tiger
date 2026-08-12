import { Module } from "@nestjs/common";
import { BapModule } from "./bap/bap.module";
import { DemonwareModule } from "./demonware/demonware.module";
import { SignonModule } from "./signon/signon.module";

@Module({
  imports: [SignonModule, BapModule, DemonwareModule],
  exports: [SignonModule, BapModule, DemonwareModule],
})
export class TigerModule {}

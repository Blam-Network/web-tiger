import { Module } from "@nestjs/common";
import { BapModule } from "./bap/bap.module";
import { DatamineModule } from "./datamine/datamine.module";
import { DemonwareModule } from "./demonware/demonware.module";
import { SignonModule } from "./signon/signon.module";

@Module({
  imports: [SignonModule, DatamineModule, BapModule, DemonwareModule],
  exports: [SignonModule, DatamineModule, BapModule, DemonwareModule],
})
export class TigerModule {}

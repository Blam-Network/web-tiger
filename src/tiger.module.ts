import { Module } from '@nestjs/common';
import { SignonModule } from './signon/signon.module';

@Module({
  imports: [SignonModule],
  exports: [SignonModule],
})
export class TigerModule {}

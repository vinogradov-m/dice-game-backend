import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisFactoryService } from './redis-factory.service';

@Global()
@Module({
  imports: [],
  providers: [RedisFactoryService],
  exports: [RedisFactoryService],
})
export class RedisModule {}

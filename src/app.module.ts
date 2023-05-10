import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { GameModule } from './game/game.module';
import { IamModule } from './iam/iam.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RoomModule } from './room/room.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    RoomModule,
    IamModule,
    GameModule,
  ],
})
export class AppModule {}

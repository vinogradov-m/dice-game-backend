import { Module } from '@nestjs/common';

import { IamModule } from '../iam/iam.module';
import { RoomModule } from '../room/room.module';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Module({
  imports: [RoomModule, IamModule],
  providers: [GameGateway, GameService],
  exports: [GameService],
})
export class GameModule {}

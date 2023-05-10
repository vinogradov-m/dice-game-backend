import { Injectable } from '@nestjs/common';
import { Room } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RoomWithUsers } from '../prisma/prisma.types';

@Injectable()
export class RoomService {
  constructor(private readonly prismaService: PrismaService) {}

  async getRoomList(): Promise<Room[]> {
    return this.prismaService.room.findMany();
  }

  async roomExists(roomId: number): Promise<boolean> {
    const roomQty = await this.prismaService.room.count({
      where: { id: roomId },
    });
    return roomQty > 0;
  }

  async getRoomDetail(roomId: number): Promise<RoomWithUsers> {
    return this.prismaService.room.findUnique({
      where: { id: roomId },
      include: { users: true },
    });
  }
}

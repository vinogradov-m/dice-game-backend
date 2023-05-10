import { Prisma } from '@prisma/client';

export type GameWithMoves = Prisma.GameGetPayload<{
  include: { gameMoves: true };
}>;

export type RoomWithUsers = Prisma.RoomGetPayload<{
  include: { users: true };
}>;

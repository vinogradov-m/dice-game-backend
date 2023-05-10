import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, User } from '@prisma/client';
import { randomInt } from 'crypto';
import { Server, Socket } from 'socket.io';

import { PrismaService } from '../prisma/prisma.service';
import { GameWithMoves } from '../prisma/prisma.types';
import { RoomService } from '../room/room.service';
import { GameEvent } from './game.enums';
import { GameError } from './game.errors';
import { getGameRoomRoomName, getUserRoomName } from './game.utils';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly roomService: RoomService,
  ) {}

  public async subscribeToUserEvents(
    socket: Socket,
    userId: number,
  ): Promise<void> {
    await socket.join(getUserRoomName(userId));
  }

  public async unsubscribeFromUserEvents(
    socket: Socket,
    userId: number,
  ): Promise<void> {
    await socket.leave(getUserRoomName(userId));
  }

  public async subscribeToRoomEvents(
    socket: Socket,
    roomId: number,
    oldRoomId: number | null,
  ): Promise<void> {
    await socket.join(getGameRoomRoomName(roomId));
    if (oldRoomId) {
      await this.unsubscribeFromRoomEvents(socket, oldRoomId);
    }
  }

  public async unsubscribeFromRoomEvents(
    socket: Socket,
    roomId: number,
  ): Promise<void> {
    await socket.leave(getGameRoomRoomName(roomId));
  }

  private async hasActiveGame(roomId: number): Promise<boolean> {
    const activeGameQty = await this.prismaService.game.count({
      where: { roomId, finished: false },
    });
    return activeGameQty > 0;
  }

  private async getActiveGame(
    roomId: number,
    txnHandler: PrismaClient = this.prismaService,
  ): Promise<GameWithMoves> {
    return txnHandler.game.findFirst({
      where: { roomId, finished: false },
      include: { gameMoves: true },
    });
  }

  private async checkActiveGame(
    game: GameWithMoves,
    server: Server,
    txnHandler: PrismaClient = this.prismaService,
  ): Promise<void> {
    // the logic is,
    // 1. game moves for all players in a room are created in advance,
    // but they contain zero values;
    // 2. when a player makes a move, the corresponding game move is updated
    // 3. when a player leaves a room, the corresponding game move is deleted
    // 4. if there is at least one game move with zero values, the game is not
    // finished yet.
    if (game.gameMoves.some((move) => move.result === 0)) {
      return;
    }

    await txnHandler.game.update({
      where: { id: game.id },
      data: { finished: true },
    });

    // The edge case is when the last player leaves the room without rolling
    // the die. In this case, there is not much sense in trying to broadcast
    // the result (it will be zero anyway).
    if (game.gameMoves.length === 0) {
      return;
    }

    let winnerIds: number[] = [];
    let maxResult = 0;
    for (const move of game.gameMoves) {
      if (move.result > maxResult) {
        maxResult = move.result;
        winnerIds = [move.userId];
      } else if (move.result === maxResult) {
        winnerIds.push(move.userId);
      }
    }
    // in general, it's bad practice to interact with other services
    // without committing the database transaction first;
    // to not make things complicated, schedule event broadcasting right here
    queueMicrotask(() => {
      server.to(getGameRoomRoomName(game.roomId)).emit(GameEvent.GameFinished, {
        max_score: maxResult,
        winner_ids: winnerIds,
      });
    });
  }

  private async removeUserFromGameRoom(
    userId: number,
    roomId: number,
    server: Server,
    txnHandler: PrismaClient = this.prismaService,
  ): Promise<void> {
    const game = await this.getActiveGame(roomId, txnHandler);
    await txnHandler.user.update({
      where: { id: userId },
      data: { activeRoomId: null },
    });
    if (game) {
      await txnHandler.gameMove.deleteMany({
        where: { gameId: game.id, userId },
      });
      await this.checkActiveGame(game, server, txnHandler);
    }
  }

  public async addUserToGameRoom(
    user: User,
    roomId: number,
    server: Server,
    client: Socket,
  ): Promise<void> {
    const { activeRoomId } = user;
    if (activeRoomId === roomId) {
      this.logger.log(`User ${user.id} is already in room ${roomId}`);
      return;
    }

    if (!(await this.roomService.roomExists(roomId))) {
      throw new GameError('Room does not exist');
    }

    await this.prismaService.$transaction(async (txnHandler) => {
      if (activeRoomId) {
        await this.removeUserFromGameRoom(
          user.id,
          activeRoomId,
          server,
          txnHandler as unknown as PrismaClient,
        );
      }
      await this.prismaService.user.update({
        where: { id: user.id },
        data: { activeRoomId: roomId },
      });
    });

    // please note that all operations with socket need to be performed
    // outside the db transaction to avoid performance issues
    client.data.user.activeRoomId = roomId;
    await this.subscribeToRoomEvents(client, roomId, activeRoomId);
    // notify all active clients of the given user
    // rather than the current client only
    server
      .to(getUserRoomName(user.id))
      .emit(GameEvent.JoinedRoom, { room_id: roomId });
  }

  private validateUserInRoom(user: User): void {
    if (!user.activeRoomId) {
      throw new GameError('User is not in a room');
    }
  }

  private async lockRoom(roomId: number): Promise<void> {
    // to prevent race conditions, we need to lock the room
    // while some important operations are performed,
    // e.g. starting a new game
    // we can use Redis for this purpose
    // TODO: implement
    this.logger.log(`Locking room ${roomId}`);
  }

  private async releaseRoom(roomId: number): Promise<void> {
    // TODO: implement
    this.logger.log(`Releasing room ${roomId}`);
  }

  private async startNewGame(roomId: number, server: Server): Promise<void> {
    const room = await this.roomService.getRoomDetail(roomId);
    const game = await this.prismaService.game.create({
      data: {
        roomId,
        finished: false,
        gameMoves: {
          create: room.users.map((user) => ({
            userId: user.id,
            result: 0,
          })),
        },
      },
    });

    server.to(getGameRoomRoomName(roomId)).emit(GameEvent.GameStarted, {
      game_id: game.id,
      player_qty: room.users.length,
    });
  }

  public async processNewGameRequest(
    user: User,
    server: Server,
  ): Promise<void> {
    this.validateUserInRoom(user);
    const { activeRoomId } = user;
    await this.lockRoom(activeRoomId);
    try {
      if (await this.hasActiveGame(activeRoomId)) {
        throw new GameError('Game is already in progress');
      }
      await this.startNewGame(activeRoomId, server);
    } finally {
      await this.releaseRoom(activeRoomId);
    }
  }

  public async processDieRollRequest(
    user: User,
    server: Server,
  ): Promise<void> {
    this.validateUserInRoom(user);
    const { activeRoomId } = user;
    await this.lockRoom(activeRoomId);
    try {
      const game = await this.getActiveGame(activeRoomId);
      if (!game) {
        throw new GameError('There is no active game in the room');
      }

      const userMove = game.gameMoves.find((move) => move.userId === user.id);
      // user joined the room after the game was started
      if (!userMove) {
        throw new GameError('User cannot participate in this game');
      }
      if (userMove.result > 0) {
        throw new GameError('User has already rolled the die');
      }

      const result = randomInt(1, 6);
      // updating the "cached" version of the game move
      // to avoid unnecessary db queries
      userMove.result = result;
      await this.prismaService.$transaction(async (txnHandler) => {
        await txnHandler.gameMove.update({
          where: { id: userMove.id },
          data: { result },
        });
        await this.checkActiveGame(
          game,
          server,
          txnHandler as unknown as PrismaClient,
        );
      });

      // according to the technical task, all players in a room
      // need to be notified about user's move
      server.to(getGameRoomRoomName(activeRoomId)).emit(GameEvent.DieRolled, {
        result,
        user_id: user.id,
      });
    } finally {
      await this.releaseRoom(activeRoomId);
    }
  }
}

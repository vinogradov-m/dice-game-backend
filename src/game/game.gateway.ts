import { Logger, ParseIntPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { User } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { Server, Socket } from 'socket.io';

import { AuthService } from '../iam/auth.service';
import { RoomService } from '../room/room.service';
import { RoomDto } from './game.dto';
import { GameEvent } from './game.enums';
import { GameService } from './game.service';

@WebSocketGateway({ namespace: '/game' })
export class GameGateway
  implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>
{
  private readonly logger = new Logger(GameGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
  ) {}

  async handleConnection(client: Socket): Promise<any> {
    try {
      const token = client.handshake.query.token as string;
      const user = await this.authService.validateToken(token);
      this.logger.log(`User ${user.login} connected to the game server`);
      client.data.user = user;
      // join the room for user-specific events
      // it's required for cases when the same user uses multiple clients
      await this.gameService.subscribeToUserEvents(client, user.id);
      // start listening to the game room events
      if (user.activeRoomId) {
        await this.gameService.subscribeToRoomEvents(
          client,
          user.activeRoomId,
          null,
        );
      }
    } catch (error) {
      this.logger.error(`Cannot authenticate user: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    if (!client.data.user) {
      return;
    }
    const { id: userId, activeRoomId } = client.data.user as User;
    await this.gameService.unsubscribeFromUserEvents(client, userId);
    if (activeRoomId) {
      await this.gameService.unsubscribeFromRoomEvents(client, activeRoomId);
    }
  }

  @SubscribeMessage(GameEvent.RoomListRequested)
  async handleRoomListRequest(): Promise<WsResponse<RoomDto[]>> {
    // when a user requests the room list, we can just send it back
    // without the necessity to broadcast it to all clients of this user
    const rooms = await this.roomService.getRoomList();
    return {
      event: GameEvent.RoomListGenerated,
      data: plainToInstance(RoomDto, rooms),
    };
  }

  @SubscribeMessage(GameEvent.RoomJoinRequested)
  async handleRoomJoinRequest(
    @ConnectedSocket() socket: Socket,
    @MessageBody(ParseIntPipe) roomId: number,
  ): Promise<WsResponse | void> {
    try {
      await this.gameService.addUserToGameRoom(
        socket.data.user,
        roomId,
        this.server,
        socket,
      );
    } catch (error) {
      this.logger.warn(`Cannot join a room: ${error.message}`);
      return {
        event: GameEvent.RoomJoinFailed,
        data: { error: error.message },
      };
    }
  }

  @SubscribeMessage(GameEvent.GameStartRequested)
  async handleGameStartRequest(
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    try {
      await this.gameService.processNewGameRequest(
        socket.data.user,
        this.server,
      );
    } catch (error) {
      // all errors related to starting a new game are silently ignored
      this.logger.warn(`Cannot start a new game: ${error.message}`);
    }
  }

  @SubscribeMessage(GameEvent.DieRollRequested)
  async handleDieRollRequest(
    @ConnectedSocket() socket: Socket,
  ): Promise<WsResponse | void> {
    try {
      await this.gameService.processDieRollRequest(
        socket.data.user,
        this.server,
      );
    } catch (error) {
      this.logger.warn(`Cannot roll a die: ${error.message}`);
      return {
        event: GameEvent.DieRollFailed,
        data: { error: error.message },
      };
    }
  }
}

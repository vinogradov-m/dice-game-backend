import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Socket, io } from 'socket.io-client';

import { AppModule } from '../src/app.module';
import { GameEvent } from '../src/game/game.enums';

describe('Game Gateway (e2e)', () => {
  let app: INestApplication;
  let client: Socket;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(3000);

    // todo: get rid of hardcoded values
    client = io(`ws://localhost:3000/game?token=alice`, {
      transports: ['websocket'],
    });
    await client.connect();
  });

  afterEach(async () => {
    client.disconnect();
    await app.close();
  });

  it('should return the list of rooms on demand', (done) => {
    client.once('connect', () => {
      client.emit(GameEvent.RoomListRequested, null);

      client.on(GameEvent.RoomListGenerated, (data) => {
        try {
          expect(data).toBeDefined();
          expect(data).toBeInstanceOf(Array);
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    client.on('connect_error', (error) => {
      done(error);
    });
  });
});

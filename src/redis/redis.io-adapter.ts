import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { ServerOptions } from 'socket.io';

import { RedisFactoryService } from './redis-factory.service';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private redisFactory: RedisFactoryService;
  private configService: ConfigService;

  constructor(app: INestApplication) {
    super();
    this.redisFactory = app.get(RedisFactoryService);
    this.configService = app.get(ConfigService);
  }

  async initializeAdapter(): Promise<void> {
    const [pubClient, subClient] = await Promise.all([
      this.redisFactory.createSecondaryClient(),
      this.redisFactory.createSecondaryClient(),
    ]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    port = this.configService.get<number>('WS_PORT');
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

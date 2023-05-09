import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

import { Redis } from './redis.types';

@Injectable()
export class RedisFactoryService implements OnModuleInit, OnModuleDestroy {
  private readonly primaryClient: Redis;
  private readonly secondaryClients: Redis[] = [];

  constructor(private readonly configService: ConfigService) {
    const host = configService.get<string>('REDIS_HOST');
    const port = configService.get<number>('REDIS_PORT');
    const password = configService.get<string>('REDIS_PASSWORD');
    this.primaryClient = createClient({
      url: `redis://${host}:${port}`,
      password,
    });
  }

  async onModuleInit() {
    await this.primaryClient.connect();
  }

  async onModuleDestroy() {
    const tasks: Promise<void>[] = [this.primaryClient.disconnect()];
    for (const it of this.secondaryClients) {
      tasks.push(it.disconnect());
    }
    await Promise.all(tasks);
  }

  public getMainClient(): Redis {
    return this.primaryClient;
  }

  public async createSecondaryClient(): Promise<Redis> {
    const client = this.primaryClient.duplicate();
    this.secondaryClients.push(client);
    await client.connect();
    return client;
  }
}

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { RedisIoAdapter } from './redis/redis.io-adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Prisma interferes with NestJS enableShutdownHooks:
  // it listens for shutdown signals and will call process.exit()
  // before the application shutdown hooks fire.
  // To deal with this, adding a listener for Prisma beforeExit event.
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);
  // use the custom websocket adapter
  // to broadcast messages across multiple instances
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.initializeAdapter();

  await app.listen(3000);
}
bootstrap();

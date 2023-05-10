import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { RedisIoAdapter } from './redis/redis.io-adapter';

async function bootstrap() {
  let app = await NestFactory.create(AppModule);
  // use the custom websocket adapter
  // to broadcast messages across multiple instances
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.initializeAdapter();
  app = app.useWebSocketAdapter(redisIoAdapter);
  // Prisma interferes with NestJS enableShutdownHooks:
  // it listens for shutdown signals and will call process.exit()
  // before the application shutdown hooks fire.
  // To deal with this, adding a listener for Prisma beforeExit event.
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  // The current implementation of RedisIoAdapter doesn't play well
  // with app.listen(): they can't share the same port.
  // So just initialize the app and let the IO servers created by RedisIoAdapter
  // listen to WS_PORT port
  await app.init();
}
bootstrap();

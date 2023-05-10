import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}

  validateToken(token: string): Promise<User> {
    // we are not going to implement the complete auth system
    // and will just check if the user exists in the database
    return this.prismaService.user.findUniqueOrThrow({
      where: { login: token },
    });
  }
}

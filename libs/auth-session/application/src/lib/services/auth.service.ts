import { Metadata } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RegisterDto } from '@nz/auth-session-presentation';
import { RegisterCommand } from '../commands';

@Injectable()
export class AuthService {
  constructor(private readonly commandBus: CommandBus) {}

  public async register(payload: RegisterDto, metadata?: Metadata) {
    return this.commandBus.execute(new RegisterCommand(payload, String(metadata?.get('Accept-Language')?.[0])));
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UsersRepository } from './repository/users.repository';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: 'UsersRepository', useClass: UsersRepository },
    JwtAuthGuard,
    JwtService,
  ],
  exports: [UsersService],
})
export class UsersModule {}

import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { IUsersRepository } from '../types/users.repository.interface';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}
  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }
  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }
  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
    return;
  }
  save(user: CreateUserDto): Promise<User> {
    const createdUser = this.repo.create(user);
    return this.repo.save(createdUser);
  }
  findAll(): Promise<User[]> {
    return this.repo.find();
  }
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    this.repo.merge(user as User, updateUserDto);
    return this.repo.save(user as User);
  }
  async saveRefreshToken(id: string, token: string | undefined): Promise<void> {
    await this.repo.update(id, { refreshToken: token });
    return;
  }
}

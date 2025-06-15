import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { IUsersRepository } from './types/users.repository.interface';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { UserCacheKey } from './types/userCacheKey.enum';

@Injectable()
export class UsersService {
  constructor(
    @Inject('UsersRepository')
    private usersRepository: IUsersRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.usersRepository.save({ ...createUserDto, password: hashedPassword });
  }

  async findAll(): Promise<User[]> {
    const key = UserCacheKey.ALL;
    const fromCache = await this.cacheManager.get<User[]>(key);
    if (fromCache) {
      return fromCache;
    }
    const fromDb = this.usersRepository.findAll();
    await this.cacheManager.set(key, fromDb, 600);
    return this.usersRepository.findAll();
  }

  async findOne(id: string): Promise<User> {
    const key = UserCacheKey.USER_WITH_ID + id;
    const fromCache = await this.cacheManager.get<User>(key);
    if (fromCache) {
      return fromCache;
    }
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.cacheManager.set(key, user, 600);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.usersRepository.update(id, updateUserDto);
    const key = UserCacheKey.USER_WITH_ID + id;
    await this.cacheManager.del(key); // invalidate user cache
    return user;
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.deleteById(id);
    const key = UserCacheKey.USER_WITH_ID + id;
    await this.cacheManager.del(key); // invalidate user cache
    return;
  }
  async saveRefreshToken(id: string, token: string | undefined): Promise<void> {
    return this.usersRepository.saveRefreshToken(id, token);
  }
}

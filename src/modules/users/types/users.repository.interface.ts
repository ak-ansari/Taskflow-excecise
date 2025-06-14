import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';

export interface IUsersRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  deleteById(id: string): Promise<void>;
  save(user: CreateUserDto): Promise<User>;
  findAll(): Promise<User[]>;
  update(id: string, updateUserDto: UpdateUserDto): Promise<User>;
}

// src/tasks/interfaces/task-repository.interface.ts
import { TaskFilterDto } from '../dto/task-filter.dto';
import { Task } from '../entities/task.entity';
import { TaskStatus } from '../enums/task-status.enum';

export interface ITaskRepository {
  create(task: Partial<Task>): Promise<Task>;
  findOneById(id: string): Promise<Task | null>;
  findByStatus(status: TaskStatus): Promise<Task[]>;
  getStatistics(): Promise<Record<string, number>>;
  findAll(filter: TaskFilterDto): Promise<[Task[], number]>;
  findOverdue(page?: number, limit?: number): Promise<Task[]>;
  deleteById(id: string): Promise<number>;
  deleteByIds(ids: string[]): Promise<number>;
  updateStatusBulk(ids: string[], status: TaskStatus): Promise<number>;
}

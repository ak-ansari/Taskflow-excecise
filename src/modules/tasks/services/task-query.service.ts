import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TaskFilterDto } from '../dto/task-filter.dto';
import { Task } from '../entities/task.entity';
import { TaskStatus } from '../enums/task-status.enum';
import { ITaskRepository } from '../types/tasks-repositoy.interface';
import { TaskCacheKey } from '../enums/task-cache-key.enum';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class TaskQueryService {
  constructor(
    @Inject('TasksRepository')
    private tasksRepository: ITaskRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(taskFilterDto: TaskFilterDto): Promise<{ data: Task[]; count: number }> {
    const [data, count] = await this.tasksRepository.findAll(taskFilterDto);
    return { data, count };
  }

  async findOne(id: string): Promise<Task> {
    const key = TaskCacheKey.TASK_WITH_ID + id;
    const fromCache = await this.cacheManager.get<Task>(key);
    if (fromCache) {
      return fromCache;
    }
    // Inefficient implementation: two separate database calls
    const result = await this.tasksRepository.findOneById(id);

    if (!result) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    await this.cacheManager.set(key, result);
    return result;
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return this.tasksRepository.findByStatus(status);
  }

  async getStatics() {
    return await this.tasksRepository.getStatistics();
  }
  getOverdueTasks(options?: { page: number; limit: number }) {
    return this.tasksRepository.findOverdue(options?.page, options?.limit);
  }
}

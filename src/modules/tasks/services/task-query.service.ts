import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TaskFilterDto } from '../dto/task-filter.dto';
import { Task } from '../entities/task.entity';
import { TaskStatus } from '../enums/task-status.enum';
import { ITaskRepository } from '../types/tasks-repositoy.interface';

@Injectable()
export class TaskQueryService {
  constructor(
    @Inject('TasksRepository')
    private tasksRepository: ITaskRepository,
  ) {}

  async findAll(taskFilterDto: TaskFilterDto): Promise<{ data: Task[]; count: number }> {
    const [data, count] = await this.tasksRepository.findAll(taskFilterDto);
    return { data, count };
  }

  async findOne(id: string): Promise<Task> {
    // Inefficient implementation: two separate database calls
    const result = await this.tasksRepository.findOneById(id);

    if (!result) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
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

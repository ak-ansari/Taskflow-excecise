import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository, FindManyOptions, LessThan } from 'typeorm';
import { TaskFilterDto } from '../dto/task-filter.dto';
import { Task } from '../entities/task.entity';
import { TaskPriority } from '../enums/task-priority.enum';
import { TaskStatus } from '../enums/task-status.enum';

@Injectable()
export class TaskQueryService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
  ) {}

  async findAll(taskFilterDto: TaskFilterDto): Promise<{ data: Task[]; count: number }> {
    // extraction all the properties passed in the query
    const { endDate, limit, page, priority, search, startDate, status, userId } = taskFilterDto;
    const query = this.tasksRepository.createQueryBuilder('task');
    if (search && search !== '') {
      query.andWhere('(task.title ILIKE :search OR task.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (status) {
      query.andWhere(`task.status = :status`, { status });
    }
    if (userId) {
      query.andWhere(`task.userId = :userId`, { userId });
    }
    if (priority) {
      query.andWhere(`task.priority = :priority`, { priority });
    }
    if (startDate) {
      query.andWhere(`task.dueDate >= :startDate`, { startDate });
    }
    if (endDate) {
      query.andWhere(`task.dueDate >= :endDate`, { endDate });
    }
    if (page && limit) {
      const skip = (page - 1) * limit;
      query.skip(skip).take(limit);
    }

    const [data, count] = await query.getManyAndCount();
    return { data, count };
  }

  async findOne(id: string): Promise<Task> {
    // Inefficient implementation: two separate database calls
    const result = await this.tasksRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!result) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return result;
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return this.tasksRepository.find({ where: { status } });
  }

  async getStatics() {
    const stats = await this.tasksRepository
      .createQueryBuilder('task')
      .select('COUNT(*)', 'total')
      .addSelect(`COUNT(CASE WHEN task.status = :completed THEN 1 END)`, 'completed')
      .addSelect(`COUNT(CASE WHEN task.status = :inProgress THEN 1 END)`, 'inProgress')
      .addSelect(`COUNT(CASE WHEN task.status = :pending THEN 1 END)`, 'pending')
      .addSelect(`COUNT(CASE WHEN task.priority = :high THEN 1 END)`, 'highPriority')
      .setParameters({
        completed: TaskStatus.COMPLETED,
        inProgress: TaskStatus.IN_PROGRESS,
        pending: TaskStatus.PENDING,
        high: TaskPriority.HIGH,
      })
      .getRawOne();

    // Convert string results to numbers
    return {
      total: parseInt(stats.total, 10),
      completed: parseInt(stats.completed, 10),
      inProgress: parseInt(stats.inProgress, 10),
      pending: parseInt(stats.pending, 10),
      highPriority: parseInt(stats.highPriority, 10),
    };
  }
  getOverdueTasks(options?: { page: number; limit: number }) {
    const query: FindManyOptions<Task> = {
      where: {
        dueDate: LessThan(new Date()),
        status: TaskStatus.PENDING,
      },
    };
    if (options?.page && options?.limit) {
      query.take = options.limit;
      query.skip = (options.page - 1) * options.limit;
    }
    return this.tasksRepository.find(query);
  }
}

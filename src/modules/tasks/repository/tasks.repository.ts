// src/tasks/repositories/typeorm-task.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { Task } from '../entities/task.entity';
import { TaskFilterDto } from '../dto/task-filter.dto';
import { TaskStatus } from '../enums/task-status.enum';
import { TaskPriority } from '../enums/task-priority.enum';
import { ITaskRepository } from '../types/tasks-repositoy.interface';

@Injectable()
export class TaskRepository implements ITaskRepository {
  constructor(
    @InjectRepository(Task)
    private readonly repo: Repository<Task>,
  ) {}
  async create(task: Partial<Task>): Promise<Task> {
    const createdTask = this.repo.create(task);
    return this.repo.save(createdTask);
  }
  async deleteById(id: string): Promise<number> {
    const result = await this.repo.delete(id);
    return result.affected as number;
  }
  async deleteByIds(ids: string[]): Promise<number> {
    const result = await this.repo.delete({ id: In(ids) });
    return result.affected as number;
  }
  async updateStatusBulk(ids: string[], status: TaskStatus): Promise<number> {
    const result = await this.repo.update({ id: In(ids) }, { status });
    return result.affected as number;
  }

  async findAll(filter: TaskFilterDto): Promise<[Task[], number]> {
    const { endDate, limit, page, priority, search, startDate, status, userId } = filter;
    const query = this.repo.createQueryBuilder('task');

    if (search) {
      query.andWhere('(task.title ILIKE :search OR task.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (status) query.andWhere('task.status = :status', { status });
    if (userId) query.andWhere('task.userId = :userId', { userId });
    if (priority) query.andWhere('task.priority = :priority', { priority });
    if (startDate) query.andWhere('task.dueDate >= :startDate', { startDate });
    if (endDate) query.andWhere('task.dueDate <= :endDate', { endDate });

    if (page && limit) {
      query.skip((page - 1) * limit).take(limit);
    }

    return query.getManyAndCount();
  }

  async findOneById(id: string): Promise<Task | null> {
    return this.repo.findOne({ where: { id }, relations: ['user'] });
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return this.repo.find({ where: { status } });
  }

  async getStatistics(): Promise<Record<string, number>> {
    const stats = await this.repo
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

    return {
      total: parseInt(stats.total, 10),
      completed: parseInt(stats.completed, 10),
      inProgress: parseInt(stats.inProgress, 10),
      pending: parseInt(stats.pending, 10),
      highPriority: parseInt(stats.highPriority, 10),
    };
  }

  async findOverdue(page?: number, limit?: number): Promise<Task[]> {
    const query = {
      where: {
        dueDate: LessThan(new Date()),
        status: TaskStatus.PENDING,
      },
      ...(page && limit ? { skip: (page - 1) * limit, take: limit } : {}),
    };
    return this.repo.find(query);
  }
}

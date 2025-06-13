import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';
import { TaskFilterDto } from './dto/task-filter.dto';
import { TaskPriority } from './enums/task-priority.enum';
import { BatchResult } from './types/tasks.interface';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectQueue('task-processing')
    private taskQueue: Queue,
    private dataSource: DataSource,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const task = queryRunner.manager.create(Task, createTaskDto);
      const savedTask = await queryRunner.manager.save(Task, task);

      // Queueing must be after DB insert is successful
      await this.taskQueue.add('task-status-update', {
        taskId: savedTask.id,
        status: savedTask.status,
      });

      await queryRunner.commitTransaction();
      return savedTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new Error(`Task creation failed: ${(error as Error).message}`);
    } finally {
      await queryRunner.release();
    }
  }

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

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    return await this.dataSource.transaction(async manager => {
      const existingTask = await manager.findOne(Task, { where: { id } });

      if (!existingTask) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      const originalStatus = existingTask.status;

      const updates = manager.merge(Task, existingTask, updateTaskDto);
      const updatedTask = await manager.save(Task, updates);

      if (updateTaskDto.status && originalStatus !== updateTaskDto.status) {
        try {
          await this.taskQueue.add('task-status-update', {
            taskId: id,
            status: updateTaskDto.status,
          });
        } catch (err) {
          throw new HttpException('Failed to update task', 500);
        }
      }

      return updatedTask;
    });
  }

  async remove(id: string): Promise<void> {
    const result = await this.tasksRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return this.tasksRepository.find({ where: { status } });
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    // This method will be called by the task processor
    const task = await this.findOne(id);
    task.status = status as any;
    return this.tasksRepository.save(task);
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
  async batchUpdateStatus(taskIds: string[], status: TaskStatus): Promise<number | undefined> {
    const result = await this.tasksRepository.update({ id: In(taskIds) }, { status });
    return result.affected;
  }
  async batchRemove(taskIds: string[]): Promise<number | undefined | null> {
    const result = await this.tasksRepository.delete({ id: In(taskIds) });
    return result.affected;
  }
}

import { InjectQueue } from '@nestjs/bullmq';
import { HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource, In } from 'typeorm';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { Task } from '../entities/task.entity';
import { TaskStatus } from '../enums/task-status.enum';
import { ITaskRepository } from '../types/tasks-repositoy.interface';
import { CACHE_MANAGER, Cache, CacheKey } from '@nestjs/cache-manager';
import { TaskCacheKey } from '../enums/task-cache-key.enum';

@Injectable()
export class TaskCommandService {
  constructor(
    @Inject('TaskRepository')
    private tasksRepository: ITaskRepository,
    @InjectQueue('task-processing')
    private taskQueue: Queue,
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
      const key = TaskCacheKey.TASK_WITH_ID + id;
      await this.cacheManager.del(key); // invalidate task cache on update

      return updatedTask;
    });
  }

  async remove(id: string): Promise<void> {
    const result = await this.tasksRepository.deleteById(id);

    if (result === 0) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    const key = TaskCacheKey.TASK_WITH_ID + id;
    await this.cacheManager.del(key); // invalidate task cache on update
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    // This method will be called by the task processor
    const task = await this.tasksRepository.findOneById(id);
    if (!task) {
      throw new NotFoundException(`Task With Id ${id} not found`);
    }
    task.status = status as TaskStatus;
    const result = await this.tasksRepository.create(task);

    const key = TaskCacheKey.TASK_WITH_ID + id;
    await this.cacheManager.del(key); // invalidate task cache on update
    return result;
  }

  async batchUpdateStatus(taskIds: string[], status: TaskStatus): Promise<number | undefined> {
    const result = await this.tasksRepository.updateStatusBulk(taskIds, status);
    for (const id of taskIds) {
      await this.cacheManager.del(TaskCacheKey.TASK_WITH_ID + id);
    }
    return result;
  }
  async batchRemove(taskIds: string[]): Promise<number | undefined | null> {
    const result = await this.tasksRepository.deleteByIds(taskIds);
    for (const id of taskIds) {
      await this.cacheManager.del(TaskCacheKey.TASK_WITH_ID + id);
    }
    return result;
  }
}

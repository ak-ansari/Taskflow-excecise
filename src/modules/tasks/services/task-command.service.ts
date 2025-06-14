import { InjectQueue } from '@nestjs/bullmq';
import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository, DataSource, In } from 'typeorm';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { Task } from '../entities/task.entity';
import { TaskStatus } from '../enums/task-status.enum';

@Injectable()
export class TaskCommandService {
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
      }, {});

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

      return updatedTask;
    });
  }

  async remove(id: string): Promise<void> {
    const result = await this.tasksRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    // This method will be called by the task processor
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!task) {
      throw new NotFoundException(`Task With Id ${id} not found`);
    }
    task.status = status as TaskStatus;
    return this.tasksRepository.save(task);
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

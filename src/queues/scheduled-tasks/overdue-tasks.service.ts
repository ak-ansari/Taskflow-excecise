import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from '../../modules/tasks/entities/task.entity';
import { TaskQueryService } from '@modules/tasks/services/task-query.service';

@Injectable()
export class OverdueTasksService {
  private readonly logger = new Logger(OverdueTasksService.name);

  constructor(
    @InjectQueue('task-processing')
    private taskQueue: Queue,
    @InjectRepository(Task)
    private taskQueryService: TaskQueryService,
  ) {}

  // TODO: Implement the overdue tasks checker
  // This method should run every hour and check for overdue tasks
  @Cron(CronExpression.EVERY_HOUR)
  async checkOverdueTasks() {
    this.logger.debug('Checking for overdue tasks...');

    // TODO: Implement overdue tasks checking logic
    // 1. Find all tasks that are overdue (due date is in the past)
    // 2. Add them to the task processing queue
    // 3. Log the number of overdue tasks found
    const overdueTasks = await this.taskQueryService.getOverdueTasks();

    this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

    // Add tasks to the queue to be processed
    const mappedTasks = overdueTasks.map(task => ({
      name: 'overdue-tasks-notification',
      data: task,
    }));
    // TODO: Implement adding tasks to the queue
    await this.taskQueue.addBulk(mappedTasks);

    this.logger.debug('Overdue tasks check completed');
  }
}

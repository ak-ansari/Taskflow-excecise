import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TaskQueryService } from '@modules/tasks/services/task-query.service';
import { TaskCommandService } from '@modules/tasks/services/task-command.service';

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_CONCURRENCY = 5;
const VALID_STATUSES = ['pending', 'in-progress', 'completed', 'overdue']; // Example statuses

@Injectable()
@Processor('task-processing')
export class TaskProcessorService extends WorkerHost {
  private readonly logger = new Logger(TaskProcessorService.name);

  constructor(
    private readonly tasksQueryService: TaskQueryService,
    private readonly tasksCommandService: TaskCommandService,
  ) {
    super();
  }

  // Batch processing with retries and concurrency control
  async processBatch(
    jobs: Job[],
    batchSize: number = DEFAULT_BATCH_SIZE,
    maxRetries: number = DEFAULT_MAX_RETRIES,
    concurrency: number = DEFAULT_CONCURRENCY,
  ): Promise<any[]> {
    const results: any[] = [];

    const processWithRetry = async (job: Job, retries = 0): Promise<any> => {
      try {
        this.logger.debug(`Processing job ${job.id} of type ${job.name}, attempt ${retries + 1}`);
        switch (job.name) {
          case 'task-status-update':
            return await this.handleStatusUpdate(job);
          case 'overdue-tasks-notification':
            return await this.handleOverdueTasks(job);
          default:
            this.logger.warn(`Unknown job type: ${job.name}`);
            return { success: false, error: 'Unknown job type', jobId: job.id };
        }
      } catch (error) {
        this.logger.error(
          `Error processing job ${job.id} (attempt ${retries + 1}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        if (retries < maxRetries) {
          return processWithRetry(job, retries + 1);
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          jobId: job.id,
        };
      }
    };

    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      for (let j = 0; j < batch.length; j += concurrency) {
        const chunk = batch.slice(j, j + concurrency);
        const chunkResults = await Promise.allSettled(chunk.map(job => processWithRetry(job)));
        results.push(
          ...chunkResults.map(r =>
            r.status === 'fulfilled' ? r.value : { success: false, error: r.reason },
          ),
        );
      }
    }

    return results;
  }

  // Single job processing (for compatibility)
  async process(job: Job): Promise<any> {
    return (await this.processBatch([job]))[0];
  }

  // Improved status update with validation and transaction handling
  private async handleStatusUpdate(job: Job) {
    const { taskId, status } = job.data;

    if (!taskId || !status) {
      return { success: false, error: 'Missing required data', jobId: job.id };
    }

    if (!VALID_STATUSES.includes(status)) {
      return { success: false, error: `Invalid status value: ${status}`, jobId: job.id };
    }

    // no need to use transactions we just updating once and no task dependent to previous
    try {
      const task = await this.tasksCommandService.updateStatus(taskId, status);

      return {
        success: true,
        taskId: task.id,
        newStatus: task.status,
      };
    } catch (error) {
      // await this.tasksService.rollbackTransaction();
      this.logger.error(
        `Failed to update status for task ${taskId}: ${error instanceof Error ? error.message : error}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        jobId: job.id,
      };
    }
  }

  // Improved overdue tasks notification with batching/chunking
  private async handleOverdueTasks(job: Job) {
    this.logger.debug('Processing overdue tasks notification');

    try {
      // Fetch overdue tasks in chunks
      let page = 0;
      const limit = 100;
      let hasMore = true;
      let processedCount = 0;

      while (hasMore) {
        const overdueTasks = await this.tasksQueryService.getOverdueTasks({ page, limit });
        if (!overdueTasks || overdueTasks.length === 0) {
          hasMore = false;
          break;
        }

        // Process each chunk (e.g., send notifications)
        await Promise.all(
          overdueTasks.map(async task => {
            try {
              this.logger.log(`Sending notification for taskId ${task.id}`);
              processedCount++;
            } catch (err) {
              this.logger.error(
                `Failed to notify for task ${task.id}: ${err instanceof Error ? err.message : err}`,
              );
            }
          }),
        );

        page++;
        hasMore = overdueTasks.length === limit;
      }

      return { success: true, message: `Overdue tasks processed: ${processedCount}` };
    } catch (error) {
      this.logger.error(
        `Error processing overdue tasks: ${error instanceof Error ? error.message : error}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        jobId: job.id,
      };
    }
  }
}

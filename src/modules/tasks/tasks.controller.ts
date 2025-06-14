import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpException,
  HttpStatus,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Task } from './entities/task.entity';
import { TaskStatus } from './enums/task-status.enum';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { TaskFilterDto } from './dto/task-filter.dto';
import { PaginatedResponse } from '../../types/pagination.interface';
import { BatchResult } from './types/tasks.interface';
import { TaskQueryService } from './services/task-query.service';
import { TaskCommandService } from './services/task-command.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@RateLimit({ limit: 100, windowMs: 60000 })
@ApiBearerAuth()
export class TasksController {
  constructor(
    private readonly tasksQueryService: TaskQueryService,
    private readonly tasksCommandService: TaskCommandService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  async create(@Body() createTaskDto: CreateTaskDto): Promise<Task> {
    const task = await this.tasksCommandService.create(createTaskDto);
    return task;
  }

  @Get()
  @ApiOperation({ summary: 'Find all tasks with optional filtering' })
  async findAll(@Query() taskFilterDto: TaskFilterDto): Promise<PaginatedResponse<Task>> {
    const { count, data } = await this.tasksQueryService.findAll(taskFilterDto);
    const limit = taskFilterDto.limit || 10;
    const page = taskFilterDto.page || 1;
    const totalPages = Math.ceil(count / limit);
    return {
      data,
      meta: {
        total: count,
        limit,
        page,
        totalPages,
      },
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  async getStats() {
    return this.tasksQueryService.getStatics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find a task by ID' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Task> {
    const task = await this.tasksQueryService.findOne(id);
    if (!task) {
      throw new NotFoundException(`Task not found with id ${id}`);
    }
    return task;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    let task = await this.tasksQueryService.findOne(id);
    if (!task) {
      throw new NotFoundException(`Task not found with id ${id}`);
    }
    task = await this.tasksCommandService.update(id, updateTaskDto);
    return task;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  async remove(@Param('id') id: string): Promise<{ id: string }> {
    const task = await this.tasksQueryService.findOne(id);
    if (!task) {
      throw new HttpException(`Task not found with id ${id}`, HttpStatus.NOT_FOUND);
    }
    // No status code returned for success;
    // status will be sent by interceptor
    await this.tasksCommandService.remove(id);
    return { id };
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch process multiple tasks' })
  async batchProcess(
    @Body() operations: { tasks: string[]; action: string },
  ): Promise<BatchResult> {
    const { tasks: taskIds, action } = operations;

    if (!['complete', 'delete'].includes(action)) {
      throw new HttpException(`Unsupported action: ${action}`, HttpStatus.BAD_REQUEST);
    }

    try {
      let affected;

      switch (action) {
        case 'complete':
          affected = await this.tasksCommandService.batchUpdateStatus(
            taskIds,
            TaskStatus.COMPLETED,
          );
          break;

        case 'delete':
          affected = await this.tasksCommandService.batchRemove(taskIds);
          break;
      }

      return {
        updated: Number(affected),
        action,
        taskIds,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Batch operation failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          taskIds,
          action,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

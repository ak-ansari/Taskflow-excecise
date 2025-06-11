import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../enums/task-status.enum';
import { TaskPriority } from '../enums/task-priority.enum';
import { IsOptional, IsEnum, IsUUID, IsString, IsDateString, IsInt } from 'class-validator';

// TODO: Implement task filtering DTO
// This DTO should be used to filter tasks by status, priority, etc.
export class TaskFilterDto {
  // TODO: Add properties for filtering tasks
  // Example: status, priority, userId, search query, date ranges, etc.
  // Add appropriate decorators for validation and Swagger documentation
  @ApiProperty({
    enum: TaskStatus,
    description: 'Filter tasks by status',
    example: 'COMPLETED',
    required: false,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({
    enum: TaskPriority,
    description: 'Filter tasks by priority',
    example: 'HIGH',
    required: false,
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({
    description: 'Filter tasks by user ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: 'Search query to filter tasks by title or description',
    example: 'Project',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter tasks starting from this date (inclusive)',
    type: String,
    format: 'date-time',
    example: '2023-12-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Filter tasks until this date (inclusive)',
    type: String,
    format: 'date-time',
    example: '2023-12-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Current page index',
    type: Number,
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  page?: number = 1;

  @ApiProperty({
    description: 'Result limit',
    type: Number,
    example: 10,
    default: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  limit?: number = 10;
}

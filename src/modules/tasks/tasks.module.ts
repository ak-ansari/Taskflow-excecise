import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';
import { TaskCommandService } from './services/task-command.service';
import { TaskQueryService } from './services/task-query.service';
import { TaskRepository } from './repository/tasks.repository';
import { AuthModule } from '@modules/auth/auth.module';
import { AppCacheModule } from '@modules/cache/appCache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    BullModule.registerQueue({
      name: 'task-processing',
    }),
    AuthModule,
    AppCacheModule,
  ],
  controllers: [TasksController],
  providers: [
    TaskCommandService,
    TaskQueryService,
    { provide: 'TasksRepository', useClass: TaskRepository },
  ],
  exports: [TaskCommandService, TaskQueryService],
})
export class TasksModule {}

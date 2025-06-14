import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';
import { CacheService } from '@common/services/cache.service';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-ioredis';
import { TaskCommandService } from './services/task-command.service';
import { TaskQueryService } from './services/task-query.service';
import { TaskRepository } from './repository/tasks.repository';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    BullModule.registerQueue({
      name: 'task-processing',
    }),
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: redisStore,
        host: 'localhost',
        port: 6379,
        ttl: 60,
      }),
    }),
    AuthModule,
  ],
  controllers: [TasksController],
  providers: [
    TaskCommandService,
    TaskQueryService,
    CacheService,
    { provide: 'TasksRepository', useClass: TaskRepository },
  ],
  exports: [TaskCommandService, TaskQueryService],
})
export class TasksModule {}

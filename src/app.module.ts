import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepartmentModule } from './modules/department/department.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveRequestModule } from './modules/leave-request/leave-request.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { WorkScheduleModule } from './modules/work-schedule/work-schedule.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { EmergencyContactModule } from './modules/emergency-contact/emergency-contact.module';
import { EmployeeDocumentModule } from './modules/employee-document/employee-document.module';
import { StorageModule } from './common/storage/storage.module';
import { JobModule } from './common/jobs/job.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('THROTTLE_TTL', 60000),
          limit: configService.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),
    PrismaModule,
    AuditLogModule,
    StorageModule,
    JobModule,
    AuthModule,
    DepartmentModule,
    EmployeeModule,
    EmergencyContactModule,
    EmployeeDocumentModule,
    AttendanceModule,
    LeaveRequestModule,
    PayrollModule,
    WorkScheduleModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 1. JwtAuthGuard runs first to authenticate and populate request.user
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 2. RolesGuard runs second to authorize based on request.user.role
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}


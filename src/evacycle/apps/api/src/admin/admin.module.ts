import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminGradingRulesController } from './admin-grading-rules.controller';

@Module({
  controllers: [AdminController, AdminGradingRulesController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

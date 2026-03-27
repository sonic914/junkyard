import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminGradingRulesController } from './admin-grading-rules.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminSettlementsController } from './admin-settlements.controller';
import { AdminSettlementRulesController } from './admin-settlement-rules.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminLedgerController } from './admin-ledger.controller';
import { SettlementsModule } from '../settlements/settlements.module';

@Module({
  imports: [SettlementsModule],
  controllers: [
    AdminController,
    AdminGradingRulesController,
    AdminDashboardController,
    AdminSettlementsController,
    AdminSettlementRulesController,
    AdminUsersController,
    AdminLedgerController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

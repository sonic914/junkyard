import { Module } from '@nestjs/common';
import { GradingService } from './grading.service';
import { GradingController } from './grading.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { CasesModule } from '../cases/cases.module';

@Module({
  imports: [LedgerModule, CasesModule],
  controllers: [GradingController],
  providers: [GradingService],
  exports: [GradingService],
})
export class GradingModule {}

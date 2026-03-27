import { Module } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
import { SettlementHookService } from './settlement-hook.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  controllers: [SettlementsController],
  providers: [SettlementsService, SettlementHookService],
  exports: [SettlementsService, SettlementHookService],
})
export class SettlementsModule {}

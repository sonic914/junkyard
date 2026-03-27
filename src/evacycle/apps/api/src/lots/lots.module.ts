import { Module } from '@nestjs/common';
import { LotsService } from './lots.service';
import { LotsController } from './lots.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { CasesModule } from '../cases/cases.module';
import { SettlementsModule } from '../settlements/settlements.module';

@Module({
  imports: [LedgerModule, CasesModule, SettlementsModule],
  controllers: [LotsController],
  providers: [LotsService],
  exports: [LotsService],
})
export class LotsModule {}

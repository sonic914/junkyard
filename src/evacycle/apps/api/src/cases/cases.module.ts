import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { FilesModule } from '../files/files.module';
import { CaseAccessGuard } from './guards/case-access.guard';

@Module({
  imports: [LedgerModule, FilesModule],
  controllers: [CasesController],
  providers: [CasesService, CaseAccessGuard],
  exports: [CasesService, CaseAccessGuard],
})
export class CasesModule {}

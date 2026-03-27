import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { QueryLedgerDto } from './dto/query-ledger.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminLedgerController {
  constructor(private readonly adminService: AdminService) {}

  @Get('ledger')
  async findAll(@Query() query: QueryLedgerDto) {
    return this.adminService.findAllLedgerEvents(query);
  }

  @Get('ledger/verify')
  async verify(@Query('caseId') caseId?: string) {
    return this.adminService.verifyLedger(caseId);
  }

  @Get('ledger/verify-all')
  async verifyAll() {
    return this.adminService.verifyAllChains();
  }

  @Get('audit/chain-verify/:caseId')
  async chainVerify(@Param('caseId') caseId: string) {
    const result = await this.adminService.verifyLedger(caseId);

    // Case 정보 추가
    const vehicleCase = await this.adminService.findCaseForAudit(caseId);

    if (result.valid) {
      return {
        caseId,
        caseNo: vehicleCase?.caseNo,
        totalEvents: result.eventsVerified,
        verified: true,
        checkedAt: result.verifiedAt,
      };
    }

    const errors = (result as any).errors ?? [];
    const firstError = errors[0];
    return {
      caseId,
      caseNo: vehicleCase?.caseNo,
      totalEvents: result.eventsVerified,
      verified: false,
      brokenAt: firstError
        ? {
            seq: firstError.seq,
            eventType: firstError.eventType,
            expectedHash: firstError.expectedHash,
            actualHash: firstError.actualHash,
            recordedAt: firstError.recordedAt,
          }
        : null,
      checkedAt: result.verifiedAt,
    };
  }
}

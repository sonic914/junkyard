import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SettlementsService } from '../settlements/settlements.service';
import { QueryAdminSettlementsDto } from './dto/query-admin-settlements.dto';
import { ApproveSettlementDto } from '../settlements/dto/approve-settlement.dto';
import { RejectSettlementDto } from '../settlements/dto/reject-settlement.dto';
import { PaySettlementDto } from '../settlements/dto/pay-settlement.dto';
import { BatchApproveDto } from '../settlements/dto/batch-approve.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/settlements')
@Roles(UserRole.ADMIN)
export class AdminSettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  async findAll(@Query() query: QueryAdminSettlementsDto) {
    return this.settlementsService.findAllAdmin(query);
  }

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveSettlementDto,
    @Request() req: any,
  ) {
    return this.settlementsService.approveSettlement(id, dto, req.user.sub);
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectSettlementDto,
    @Request() req: any,
  ) {
    return this.settlementsService.rejectSettlement(id, dto, req.user.sub);
  }

  @Post(':id/pay')
  async pay(
    @Param('id') id: string,
    @Body() dto: PaySettlementDto,
    @Request() req: any,
  ) {
    return this.settlementsService.paySettlement(id, dto, req.user.sub);
  }

  @Post('batch-approve')
  async batchApprove(@Body() dto: BatchApproveDto, @Request() req: any) {
    return this.settlementsService.batchApprove(dto, req.user.sub);
  }
}

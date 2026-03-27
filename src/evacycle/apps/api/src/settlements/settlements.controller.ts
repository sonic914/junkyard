import {
  Controller,
  Get,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SettlementsService } from './settlements.service';
import { QuerySettlementsDto } from './dto/query-settlements.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Settlements')
@ApiBearerAuth()
@Controller()
@Roles(UserRole.OWNER, UserRole.JUNKYARD, UserRole.ADMIN)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get('settlements')
  async findAll(@Query() query: QuerySettlementsDto, @Request() req: any) {
    return this.settlementsService.findAll(query, req.user.sub, req.user.role);
  }

  @Get('settlements/:id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.settlementsService.findOne(id, req.user.sub, req.user.role);
  }

  @Get('cases/:id/settlements')
  async findCaseSettlements(@Param('id') caseId: string) {
    return this.settlementsService.findCaseSettlements(caseId);
  }
}

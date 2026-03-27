import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole, PartType } from '@prisma/client';
import { SettlementsService } from '../settlements/settlements.service';
import { CreateSettlementRuleDto } from '../settlements/dto/create-settlement-rule.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/settlement-rules')
@Roles(UserRole.ADMIN)
export class AdminSettlementRulesController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post()
  async create(@Body() dto: CreateSettlementRuleDto) {
    return this.settlementsService.createSettlementRule(dto);
  }

  @Get()
  async findAll(
    @Query('partType') partType?: PartType,
    @Query('activeOnly', new DefaultValuePipe(true), ParseBoolPipe)
    activeOnly?: boolean,
  ) {
    return this.settlementsService.findAllSettlementRules(partType, activeOnly);
  }
}

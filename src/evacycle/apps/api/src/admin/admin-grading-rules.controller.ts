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
import { AdminService } from './admin.service';
import { CreateGradingRuleDto } from './dto/create-grading-rule.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/grading-rules')
@Roles(UserRole.ADMIN)
export class AdminGradingRulesController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async create(@Body() dto: CreateGradingRuleDto) {
    return this.adminService.createGradingRule(dto);
  }

  @Get()
  async findAll(
    @Query('partType') partType?: PartType,
    @Query('activeOnly', new DefaultValuePipe(true), ParseBoolPipe)
    activeOnly?: boolean,
  ) {
    return this.adminService.findAllGradingRules(partType, activeOnly);
  }
}

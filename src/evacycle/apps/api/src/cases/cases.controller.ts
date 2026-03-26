import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { TransitionCaseDto } from './dto/transition-case.dto';
import { CancelCaseDto } from './dto/cancel-case.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CaseAccessGuard } from './guards/case-access.guard';

@ApiTags('Cases')
@ApiBearerAuth()
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.JUNKYARD, UserRole.ADMIN)
  async create(@Body() dto: CreateCaseDto, @Request() req: any) {
    return this.casesService.createCase(dto, req.user.sub, req.user.orgId);
  }

  @Post(':id/events/transition')
  @UseGuards(CaseAccessGuard)
  async transition(
    @Param('id') id: string,
    @Body() dto: TransitionCaseDto,
    @Request() req: any,
  ) {
    return this.casesService.transitionCase(
      id,
      dto.eventType,
      req.user.sub,
      req.user.role,
      dto.payload,
    );
  }

  @Post(':id/submit')
  @Roles(UserRole.OWNER, UserRole.JUNKYARD, UserRole.ADMIN)
  @UseGuards(CaseAccessGuard)
  async submit(@Param('id') id: string, @Request() req: any) {
    return this.casesService.submitCase(id, req.user.sub, req.user.role);
  }

  @Post(':id/cancel')
  @Roles(UserRole.OWNER, UserRole.JUNKYARD, UserRole.ADMIN)
  @UseGuards(CaseAccessGuard)
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelCaseDto,
    @Request() req: any,
  ) {
    return this.casesService.cancelCase(id, req.user.sub, req.user.role, dto.reason);
  }

  @Get(':id/timeline')
  @UseGuards(CaseAccessGuard)
  async timeline(@Param('id') id: string) {
    return this.casesService.getTimeline(id);
  }

  @Get()
  async findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take: number,
  ) {
    return this.casesService.findAll(skip, take);
  }

  @Get(':id')
  @UseGuards(CaseAccessGuard)
  async findOne(@Param('id') id: string) {
    return this.casesService.findOne(id);
  }
}

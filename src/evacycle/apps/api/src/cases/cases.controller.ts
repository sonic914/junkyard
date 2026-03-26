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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { Roles } from '../auth/decorators/roles.decorator';

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

  @Post(':id/submit')
  @Roles(UserRole.OWNER, UserRole.JUNKYARD, UserRole.ADMIN)
  async submit(@Param('id') id: string, @Request() req: any) {
    return this.casesService.submitCase(id, req.user.sub);
  }

  @Get()
  async findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take: number,
  ) {
    return this.casesService.findAll(skip, take);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.casesService.findOne(id);
  }
}

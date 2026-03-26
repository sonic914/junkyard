import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';

@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  async create(@Body() dto: CreateCaseDto) {
    // TODO: actorId, orgId는 JWT에서 추출 — CP1에서는 임시값
    const actorId = 'temp-actor-id';
    const orgId = 'temp-org-id';
    return this.casesService.createCase(dto, actorId, orgId);
  }

  @Post(':id/submit')
  async submit(@Param('id') id: string) {
    // TODO: actorId는 JWT에서 추출
    const actorId = 'temp-actor-id';
    return this.casesService.submitCase(id, actorId);
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

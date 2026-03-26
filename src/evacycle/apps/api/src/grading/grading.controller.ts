import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GradingService } from './grading.service';
import { CreateGradingDto } from './dto/create-grading.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CaseAccessGuard } from '../cases/guards/case-access.guard';

@ApiTags('Grading')
@ApiBearerAuth()
@Controller('cases/:id/grade')
@UseGuards(CaseAccessGuard)
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Post()
  @Roles(UserRole.HUB, UserRole.ADMIN)
  async create(
    @Param('id') caseId: string,
    @Body() dto: CreateGradingDto,
    @Request() req: any,
  ) {
    return this.gradingService.createGrading(caseId, dto, req.user.sub);
  }

  @Get()
  async findByCaseId(@Param('id') caseId: string) {
    return this.gradingService.findByCaseId(caseId);
  }
}

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { LotsService } from './lots.service';
import { CreateLotDto } from './dto/create-lot.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryLotsDto } from './dto/query-lots.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CaseAccessGuard } from '../cases/guards/case-access.guard';

@ApiTags('Lots')
@ApiBearerAuth()
@Controller()
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  // ── Case → Lot 생성 ──

  @Post('cases/:id/lots')
  @Roles(UserRole.HUB, UserRole.ADMIN)
  @UseGuards(CaseAccessGuard)
  async createLot(
    @Param('id') caseId: string,
    @Body() dto: CreateLotDto,
    @Request() req: any,
  ) {
    return this.lotsService.createLot(caseId, dto, req.user.sub);
  }

  @Get('cases/:id/lots')
  @UseGuards(CaseAccessGuard)
  async findByCaseId(@Param('id') caseId: string) {
    return this.lotsService.findByCaseId(caseId);
  }

  // ── Lot 마켓플레이스 ──

  @Get('lots')
  async findAll(@Query() query: QueryLotsDto) {
    return this.lotsService.findAll(query);
  }

  @Get('lots/:id')
  async findOne(@Param('id') lotId: string) {
    return this.lotsService.findOne(lotId);
  }

  // ── Listing (고정가 등록) ──

  @Post('lots/:id/list')
  @Roles(UserRole.HUB, UserRole.ADMIN)
  async createListing(
    @Param('id') lotId: string,
    @Body() dto: CreateListingDto,
    @Request() req: any,
  ) {
    return this.lotsService.createListing(lotId, dto, req.user.sub);
  }

  // ── 구매 ──

  @Post('lots/:id/purchase')
  @Roles(UserRole.BUYER)
  async purchase(@Param('id') lotId: string, @Request() req: any) {
    return this.lotsService.purchaseLot(lotId, req.user.sub, req.user.role);
  }
}

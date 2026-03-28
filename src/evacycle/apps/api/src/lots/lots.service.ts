import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CaseStatus,
  EventType,
  LotStatus,
  ListingStatus,
  RoutingDecision,
  UserRole,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettlementHookService } from '../settlements/settlement-hook.service';
import { CreateLotDto } from './dto/create-lot.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryLotsDto } from './dto/query-lots.dto';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class LotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly settlementHookService: SettlementHookService,
  ) {}

  // ── Lot 생성 ──

  async createLot(caseId: string, dto: CreateLotDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Case 상태 검증: GRADING 또는 ON_SALE
      const vehicleCase = await tx.vehicleCase.findUniqueOrThrow({
        where: { id: caseId },
      });
      if (
        vehicleCase.status !== CaseStatus.GRADING &&
        vehicleCase.status !== CaseStatus.ON_SALE
      ) {
        throw new ConflictException(
          'Case must be in GRADING or ON_SALE status',
        );
      }

      // 2. 해당 partType의 그레이딩 결과 확인
      const grading = await tx.grading.findFirst({
        where: { caseId, partType: dto.partType },
      });
      if (!grading) {
        throw new BadRequestException(
          `No grading found for partType ${dto.partType}`,
        );
      }
      if (grading.routingDecision === RoutingDecision.DISCARD) {
        throw new BadRequestException(
          'Cannot create lot for DISCARD routing',
        );
      }

      // 3. 중복 Lot 체크
      const existingLot = await tx.derivedLot.findFirst({
        where: { caseId, partType: dto.partType },
      });
      if (existingLot) {
        throw new ConflictException(
          `Lot for ${dto.partType} already exists in this case`,
        );
      }

      // 4. lotNo 생성
      const lotNo = await this.generateLotNo(tx);

      // 5. DerivedLot 생성
      const lot = await tx.derivedLot.create({
        data: {
          caseId,
          lotNo,
          partType: dto.partType,
          routingDecision: grading.routingDecision,
          reuseGrade:
            grading.routingDecision === RoutingDecision.REUSE
              ? grading.reuseGrade
              : null,
          recycleGrade:
            grading.routingDecision === RoutingDecision.RECYCLE
              ? grading.recycleGrade
              : null,
          quantity: dto.quantity ?? 1,
          weightKg: dto.weightKg,
          description: dto.description,
        },
      });

      // 6. CP4: Δ1 Settlement 자동생성 (그레이딩 기반 가산금)
      await this.settlementHookService.createDelta1(
        {
          id: lot.id,
          partType: lot.partType,
          reuseGrade: grading.reuseGrade,
        },
        caseId,
        actorId,
        tx,
      );

      return lot;
    });
  }

  // ── Listing 생성 (고정가 등록) ──

  async createListing(
    lotId: string,
    dto: CreateListingDto,
    actorId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lot 검증: PENDING 상태여야 함
      const lot = await tx.derivedLot.findUniqueOrThrow({
        where: { id: lotId },
        include: { listing: true, case: true },
      });
      if (lot.status !== LotStatus.PENDING) {
        throw new ConflictException('Lot must be in PENDING status');
      }
      if (lot.listing) {
        throw new ConflictException('Listing already exists for this lot');
      }

      // 2. Listing 생성
      const listing = await tx.listing.create({
        data: {
          lotId,
          type: 'FIXED_PRICE',
          price: dto.price,
          currency: dto.currency ?? 'KRW',
          status: ListingStatus.ACTIVE,
        },
      });

      // 3. Lot 상태 → ON_SALE
      await tx.derivedLot.update({
        where: { id: lotId },
        data: { status: LotStatus.ON_SALE },
      });

      // 4. Case 상태 → ON_SALE (아직 아닌 경우)
      if (lot.case.status === CaseStatus.GRADING) {
        await tx.vehicleCase.update({
          where: { id: lot.caseId },
          data: { status: CaseStatus.ON_SALE },
        });
      }

      // 5. 이벤트 원장 기록
      const event = await this.ledgerService.appendEvent(
        lot.caseId,
        actorId,
        EventType.LISTING_PUBLISHED,
        {
          lotId,
          lotNo: lot.lotNo,
          partType: lot.partType,
          price: dto.price,
          currency: dto.currency ?? 'KRW',
          type: 'FIXED_PRICE',
        },
        tx,
      );

      return { ...listing, event };
    });
  }

  // ── 구매 ──

  async purchaseLot(lotId: string, buyerId: string, buyerRole: UserRole) {
    if (buyerRole !== UserRole.BUYER) {
      throw new ForbiddenException('Only BUYER role can purchase');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Lot + Listing 조회
      const lot = await tx.derivedLot.findUniqueOrThrow({
        where: { id: lotId },
        include: { listing: true, case: true },
      });
      if (lot.status !== LotStatus.ON_SALE) {
        throw new ConflictException('Lot is not on sale');
      }
      if (!lot.listing || lot.listing.status !== ListingStatus.ACTIVE) {
        throw new ConflictException('No active listing for this lot');
      }

      const now = new Date();

      // 2. Listing 업데이트
      await tx.listing.update({
        where: { id: lot.listing.id },
        data: {
          status: ListingStatus.SOLD,
          buyerId,
          purchasedAt: now,
        },
      });

      // 3. Lot 상태 → SOLD
      await tx.derivedLot.update({
        where: { id: lotId },
        data: { status: LotStatus.SOLD },
      });

      // 4. Case의 모든 Lot이 SOLD인지 확인 → Case 상태 업데이트
      const allLots = await tx.derivedLot.findMany({
        where: { caseId: lot.caseId },
      });
      const allSold = allLots.every((l) =>
        l.id === lotId
          ? true
          : l.status === LotStatus.SOLD || l.status === LotStatus.SETTLED,
      );
      if (allSold) {
        await tx.vehicleCase.update({
          where: { id: lot.caseId },
          data: { status: CaseStatus.SOLD },
        });
      }

      // 5. 이벤트 원장 기록
      const event = await this.ledgerService.appendEvent(
        lot.caseId,
        buyerId,
        EventType.PURCHASE_COMPLETED,
        {
          lotId,
          lotNo: lot.lotNo,
          partType: lot.partType,
          price: lot.listing.price.toString(),
          currency: lot.listing.currency,
          buyerId,
        },
        tx,
      );

      // 6. CP4: M0 + Δ2 Settlement 자동생성
      await this.settlementHookService.onPurchaseCompleted(
        { id: lot.id, partType: lot.partType, caseId: lot.caseId },
        { price: lot.listing.price },
        lot.caseId,
        lot.case.createdBy,
        tx,
      );

      return {
        lotId,
        lotNo: lot.lotNo,
        purchasedAt: now,
        price: lot.listing.price,
        currency: lot.listing.currency,
        event,
      };
    });
  }

  // ── 조회 ──

  async findByCaseId(caseId: string) {
    const vehicleCase = await this.prisma.vehicleCase.findUniqueOrThrow({
      where: { id: caseId },
      select: { id: true, caseNo: true },
    });

    const lots = await this.prisma.derivedLot.findMany({
      where: { caseId },
      include: {
        listing: {
          select: { id: true, price: true, currency: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      caseId: vehicleCase.id,
      caseNo: vehicleCase.caseNo,
      lots,
    };
  }

  async findOne(lotId: string) {
    return this.prisma.derivedLot.findUniqueOrThrow({
      where: { id: lotId },
      include: {
        case: {
          select: {
            id: true,
            caseNo: true,
            vehicleMaker: true,
            vehicleModel: true,
            vehicleYear: true,
          },
        },
        listing: {
          include: {
            buyer: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });
  }

  async findAll(query: QueryLotsDto) {
    const where: Prisma.DerivedLotWhereInput = {
      status: query.status ?? LotStatus.ON_SALE,
      ...(query.partType && { partType: query.partType }),
      ...(query.reuseGrade && { reuseGrade: query.reuseGrade }),
      ...(query.recycleGrade && { recycleGrade: query.recycleGrade }),
      ...(query.routingDecision && {
        routingDecision: query.routingDecision,
      }),
      ...(query.maxPrice || query.minPrice
        ? {
            listing: {
              price: {
                ...(query.minPrice && { gte: query.minPrice }),
                ...(query.maxPrice && { lte: query.maxPrice }),
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.derivedLot.findMany({
        where,
        include: {
          case: {
            select: {
              caseNo: true,
              vehicleMaker: true,
              vehicleModel: true,
              vehicleYear: true,
            },
          },
          listing: {
            select: { id: true, price: true, currency: true, status: true },
          },
        },
        skip: query.skip ?? 0,
        take: query.take ?? 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.derivedLot.count({ where }),
    ]);

    return { items, total, skip: query.skip ?? 0, take: query.take ?? 20 };
  }

    // ── 구매 내역 조회 (바이어) ──

  async getMyOrders(
    buyerId: string,
    pagination: { page: number; limit: number },
  ) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    // 구매자 정보는 Listing.buyerId에 저장됨
    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where: { buyerId, status: 'SOLD' },
        include: {
          lot: {
            include: {
              case: { select: { caseNo: true } },
            },
          },
        },
        orderBy: { purchasedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.listing.count({ where: { buyerId, status: 'SOLD' } }),
    ]);

    return {
      items: listings.map((l) => ({
        id: l.id,
        lotId: l.lotId,
        lotNo: l.lot.lotNo,
        partType: l.lot.partType,
        price: Number(l.price),
        currency: l.currency,
        status: 'COMPLETED' as const,
        reuseGrade: l.lot.reuseGrade ?? undefined,
        recycleGrade: l.lot.recycleGrade ?? undefined,
        caseNo: l.lot.case?.caseNo,
        purchasedAt: l.purchasedAt ?? l.createdAt,
      })),
      total,
    };
  }

  // ── lotNo 생성 ──

  private async generateLotNo(
    tx: PrismaTransactionClient,
  ): Promise<string> {
    const now = new Date();
    const prefix = `LOT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const lastLot = await tx.derivedLot.findFirst({
      where: { lotNo: { startsWith: prefix } },
      orderBy: { lotNo: 'desc' },
    });

    const lastSeq = lastLot
      ? parseInt(lastLot.lotNo.split('-').pop()!, 10)
      : 0;

    return `${prefix}-${String(lastSeq + 1).padStart(5, '0')}`;
  }
}

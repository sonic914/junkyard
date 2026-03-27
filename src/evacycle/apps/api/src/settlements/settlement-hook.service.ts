import { Injectable } from '@nestjs/common';
import {
  SettlementType,
  SettlementStatus,
  EventType,
  PartType,
  LotStatus,
  PrismaClient,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class SettlementHookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Δ1 정산 자동생성 — 그레이딩 완료 시 호출
   * GradingService.createGrading() 트랜잭션 내에서 호출
   */
  async createDelta1(
    lot: { id: string; partType: PartType; reuseGrade: string | null },
    caseId: string,
    actorId: string,
    tx: PrismaTransactionClient,
  ) {
    // 1. 활성 SettlementRule 조회
    const rule = await tx.settlementRule.findFirst({
      where: { partType: lot.partType, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!rule) return null;

    // 2. 등급 가산율 조회
    const bonusMap = (rule.gradeBonusMap as Record<string, number>) ?? {};
    const bonusRate = bonusMap[lot.reuseGrade ?? 'D'] ?? 0;
    if (bonusRate === 0) return null; // D등급 → 정산 미생성

    // 3. 금액 계산
    const m0Base = Number(rule.m0BaseAmount);
    const grossAmount = m0Base * (bonusRate / 100);
    const feeRate = Number(rule.platformFeeRate);
    const feeAmount = grossAmount * feeRate;
    const netAmount = grossAmount - feeAmount;

    // 4. yardUser 결정: Case의 ownerOrg 소속 사용자
    const vehicleCase = await tx.vehicleCase.findUniqueOrThrow({
      where: { id: caseId },
    });
    const yardUser = await tx.user.findFirst({
      where: { orgId: vehicleCase.orgId, isActive: true },
    });
    if (!yardUser) throw new Error('No active yard user found');

    // 5. NewSettlement 생성
    const settlement = await tx.newSettlement.create({
      data: {
        caseId,
        lotId: lot.id,
        yardUserId: yardUser.id,
        type: SettlementType.DELTA_1,
        grossAmount,
        feeRate,
        feeAmount,
        amount: netAmount,
        ruleSnapshot: JSON.parse(JSON.stringify(rule)),
        calcDetail: {
          formula: 'DELTA_1',
          lotId: lot.id,
          partType: lot.partType,
          reuseGrade: lot.reuseGrade,
          m0BaseAmount: m0Base.toFixed(2),
          gradeBonusRate: bonusRate,
          grossAmount: grossAmount.toFixed(2),
          feeRate: feeRate.toFixed(4),
          feeAmount: feeAmount.toFixed(2),
        },
      },
    });

    // 6. 이벤트 기록
    await this.ledgerService.appendEvent(
      caseId,
      actorId,
      EventType.SETTLEMENT_CREATED,
      {
        settlementId: settlement.id,
        settlementType: 'DELTA_1',
        type: 'DELTA_1',
        amount: netAmount.toFixed(2),
        lotId: lot.id,
      },
      tx,
    );

    return settlement;
  }

  /**
   * M0 + Δ2 정산 자동생성 — 구매 완료 시 호출
   * LotsService.purchaseLot() 트랜잭션 내에서 호출
   */
  async onPurchaseCompleted(
    lot: { id: string; partType: PartType; caseId: string },
    listing: { price: Decimal },
    caseId: string,
    actorId: string,
    tx: PrismaTransactionClient,
  ) {
    const rule = await tx.settlementRule.findFirst({
      where: { partType: lot.partType, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!rule) return;

    const vehicleCase = await tx.vehicleCase.findUniqueOrThrow({
      where: { id: caseId },
    });
    const yardUser = await tx.user.findFirst({
      where: { orgId: vehicleCase.orgId, isActive: true },
    });
    if (!yardUser) throw new Error('No active yard user found');

    // ── M0: Case 단위, 1회만 ──
    const existingM0 = await tx.newSettlement.findFirst({
      where: { caseId, type: SettlementType.M0 },
    });

    if (!existingM0) {
      const allLots = await tx.derivedLot.findMany({ where: { caseId } });
      let totalM0 = 0;
      const lotDetails: Array<{ lotId: string; partType: string; m0Base: string }> = [];

      for (const l of allLots) {
        const lotRule = await tx.settlementRule.findFirst({
          where: { partType: l.partType, isActive: true },
          orderBy: { version: 'desc' },
        });
        if (lotRule) {
          const base = Number(lotRule.m0BaseAmount);
          totalM0 += base;
          lotDetails.push({
            lotId: l.id,
            partType: l.partType,
            m0Base: base.toFixed(2),
          });
        }
      }

      if (totalM0 > 0) {
        const feeRate = Number(rule.platformFeeRate);
        const feeAmount = totalM0 * feeRate;
        const m0Net = totalM0 - feeAmount;

        const m0Settlement = await tx.newSettlement.create({
          data: {
            caseId,
            yardUserId: yardUser.id,
            type: SettlementType.M0,
            grossAmount: totalM0,
            feeRate,
            feeAmount,
            amount: m0Net,
            ruleSnapshot: JSON.parse(JSON.stringify(rule)),
            calcDetail: {
              formula: 'M0',
              lots: lotDetails,
              totalM0Base: totalM0.toFixed(2),
              feeRate: feeRate.toFixed(4),
              feeAmount: feeAmount.toFixed(2),
            },
          },
        });

        await this.ledgerService.appendEvent(
          caseId,
          actorId,
          EventType.SETTLEMENT_CREATED,
          {
            settlementId: m0Settlement.id,
            settlementType: 'M0',
            type: 'M0',
            amount: m0Net.toFixed(2),
          },
          tx,
        );
      }
    }

    // ── Δ2: Lot 단위 ──
    const salePrice = Number(listing.price);
    const m0LotShare = Number(rule.m0BaseAmount);

    // Δ1 기정산액 조회 (gross 기준 — prevSettled는 수수료 전 금액)
    const delta1 = await tx.newSettlement.findFirst({
      where: { lotId: lot.id, type: SettlementType.DELTA_1 },
    });
    const delta1GrossAmount = delta1 ? Number(delta1.grossAmount) : 0;

    const prevSettled = m0LotShare + delta1GrossAmount;
    const delta2Gross = Math.max(0, salePrice - prevSettled);

    if (delta2Gross > 0) {
      const feeRate = Number(rule.platformFeeRate);
      const feeAmount = delta2Gross * feeRate;
      const delta2Net = delta2Gross - feeAmount;

      const d2Settlement = await tx.newSettlement.create({
        data: {
          caseId,
          lotId: lot.id,
          yardUserId: yardUser.id,
          type: SettlementType.DELTA_2,
          grossAmount: delta2Gross,
          feeRate,
          feeAmount,
          amount: delta2Net,
          ruleSnapshot: JSON.parse(JSON.stringify(rule)),
          calcDetail: {
            formula: 'DELTA_2',
            lotId: lot.id,
            partType: lot.partType,
            salePrice: salePrice.toFixed(2),
            m0LotShare: m0LotShare.toFixed(2),
            delta1Amount: delta1GrossAmount.toFixed(2),
            prevSettled: prevSettled.toFixed(2),
            grossAmount: delta2Gross.toFixed(2),
            feeRate: feeRate.toFixed(4),
            feeAmount: feeAmount.toFixed(2),
          },
        },
      });

      await this.ledgerService.appendEvent(
        caseId,
        actorId,
        EventType.SETTLEMENT_CREATED,
        {
          settlementId: d2Settlement.id,
          settlementType: 'DELTA_2',
          type: 'DELTA_2',
          lotId: lot.id,
          amount: delta2Net.toFixed(2),
        },
        tx,
      );
    }
  }
}

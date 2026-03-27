import { CaseStatus, EventType, UserRole } from '@prisma/client';

export interface TransitionRule {
  fromStatus: CaseStatus[];
  toStatus: CaseStatus | null;  // null = 상태 변경 없음 (이벤트 기록만)
  allowedRoles: UserRole[];
  requiredPayloadFields?: string[];
}

export const CASE_TRANSITIONS: Record<string, TransitionRule> = {
  [EventType.CASE_CREATED]: {
    fromStatus: [],
    toStatus: CaseStatus.DRAFT,
    allowedRoles: [UserRole.OWNER, UserRole.JUNKYARD, UserRole.ADMIN],
  },
  [EventType.CASE_SUBMITTED]: {
    fromStatus: [CaseStatus.DRAFT],
    toStatus: CaseStatus.SUBMITTED,
    allowedRoles: [UserRole.OWNER, UserRole.JUNKYARD, UserRole.ADMIN],
  },
  [EventType.COC_SIGNED]: {
    fromStatus: [CaseStatus.SUBMITTED],
    toStatus: CaseStatus.IN_TRANSIT,
    allowedRoles: [UserRole.JUNKYARD, UserRole.ADMIN],
    requiredPayloadFields: ['signedBy', 'signedAt'],
  },
  [EventType.INTAKE_CONFIRMED]: {
    fromStatus: [CaseStatus.IN_TRANSIT],
    toStatus: CaseStatus.RECEIVED,
    allowedRoles: [UserRole.INTAKE_JUNKYARD, UserRole.HUB, UserRole.ADMIN],
    requiredPayloadFields: ['receivedBy', 'receivedAt'],
  },
  [EventType.CASE_CANCELLED]: {
    fromStatus: [CaseStatus.DRAFT, CaseStatus.SUBMITTED],
    toStatus: CaseStatus.CANCELLED,
    allowedRoles: [UserRole.OWNER, UserRole.JUNKYARD, UserRole.ADMIN],
    requiredPayloadFields: ['reason'],
  },

  // ── CP3: 그레이딩 → 판매 → 구매 ──
  [EventType.GRADING_SUBMITTED]: {
    fromStatus: [CaseStatus.RECEIVED, CaseStatus.GRADING],
    toStatus: CaseStatus.GRADING,
    allowedRoles: [UserRole.HUB, UserRole.ADMIN],
    requiredPayloadFields: ['partType', 'reuseGrade', 'recycleGrade', 'routingDecision'],
  },
  [EventType.LISTING_PUBLISHED]: {
    fromStatus: [CaseStatus.GRADING, CaseStatus.ON_SALE],
    toStatus: CaseStatus.ON_SALE,
    allowedRoles: [UserRole.HUB, UserRole.ADMIN],
    requiredPayloadFields: ['lotId', 'price'],
  },
  [EventType.PURCHASE_COMPLETED]: {
    fromStatus: [CaseStatus.ON_SALE],
    toStatus: CaseStatus.SOLD, // 모든 Lot이 SOLD일 때만
    allowedRoles: [UserRole.BUYER],
    requiredPayloadFields: ['lotId', 'buyerId'],
  },

  // ── CP4: 정산 이벤트 ──
  [EventType.SETTLEMENT_CREATED]: {
    fromStatus: [CaseStatus.GRADING, CaseStatus.ON_SALE, CaseStatus.SOLD],
    toStatus: null,  // 상태 변경 없음 — 이벤트 기록만
    allowedRoles: [UserRole.ADMIN, UserRole.HUB, UserRole.BUYER],
    requiredPayloadFields: ['settlementId', 'settlementType', 'amount'],
  },
  [EventType.SETTLEMENT_APPROVED]: {
    fromStatus: [CaseStatus.SUBMITTED, CaseStatus.IN_TRANSIT, CaseStatus.RECEIVED,
                 CaseStatus.GRADING, CaseStatus.ON_SALE, CaseStatus.SOLD],
    toStatus: null,
    allowedRoles: [UserRole.ADMIN],
    requiredPayloadFields: ['settlementId', 'statusFrom', 'statusTo'],
  },
  [EventType.SETTLEMENT_PAID]: {
    fromStatus: [CaseStatus.SOLD],
    toStatus: CaseStatus.SETTLED,  // 모든 Settlement PAID 시에만
    allowedRoles: [UserRole.ADMIN],
    requiredPayloadFields: ['settlementId', 'statusFrom', 'statusTo'],
  },
  [EventType.SETTLEMENT_REJECTED]: {
    fromStatus: [CaseStatus.SUBMITTED, CaseStatus.IN_TRANSIT, CaseStatus.RECEIVED,
                 CaseStatus.GRADING, CaseStatus.ON_SALE, CaseStatus.SOLD],
    toStatus: null,
    allowedRoles: [UserRole.ADMIN],
    requiredPayloadFields: ['settlementId', 'rejectedReason'],
  },
};

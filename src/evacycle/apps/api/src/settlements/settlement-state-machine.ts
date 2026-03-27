import { SettlementStatus, UserRole } from '@prisma/client';

export interface SettlementTransitionRule {
  fromStatus: SettlementStatus[];
  toStatus: SettlementStatus;
  allowedRoles: UserRole[];
}

export const SETTLEMENT_TRANSITIONS: Record<string, SettlementTransitionRule> = {
  APPROVE: {
    fromStatus: [SettlementStatus.PENDING],
    toStatus: SettlementStatus.APPROVED,
    allowedRoles: [UserRole.ADMIN],
  },
  PAY: {
    fromStatus: [SettlementStatus.APPROVED],
    toStatus: SettlementStatus.PAID,
    allowedRoles: [UserRole.ADMIN],
  },
  REJECT: {
    fromStatus: [SettlementStatus.PENDING],
    toStatus: SettlementStatus.REJECTED,
    allowedRoles: [UserRole.ADMIN],
  },
};

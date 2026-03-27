import { SettlementStatus, UserRole } from '@prisma/client';
import { SETTLEMENT_TRANSITIONS } from './settlement-state-machine';

describe('SETTLEMENT_TRANSITIONS', () => {
  describe('APPROVE', () => {
    const rule = SETTLEMENT_TRANSITIONS['APPROVE'];

    it('should only allow transition from PENDING', () => {
      expect(rule.fromStatus).toEqual([SettlementStatus.PENDING]);
    });

    it('should transition to APPROVED', () => {
      expect(rule.toStatus).toBe(SettlementStatus.APPROVED);
    });

    it('should only allow ADMIN', () => {
      expect(rule.allowedRoles).toEqual([UserRole.ADMIN]);
    });
  });

  describe('PAY', () => {
    const rule = SETTLEMENT_TRANSITIONS['PAY'];

    it('should only allow transition from APPROVED', () => {
      expect(rule.fromStatus).toEqual([SettlementStatus.APPROVED]);
    });

    it('should transition to PAID', () => {
      expect(rule.toStatus).toBe(SettlementStatus.PAID);
    });

    it('should only allow ADMIN', () => {
      expect(rule.allowedRoles).toEqual([UserRole.ADMIN]);
    });
  });

  describe('REJECT', () => {
    const rule = SETTLEMENT_TRANSITIONS['REJECT'];

    it('should only allow transition from PENDING', () => {
      expect(rule.fromStatus).toEqual([SettlementStatus.PENDING]);
    });

    it('should transition to REJECTED', () => {
      expect(rule.toStatus).toBe(SettlementStatus.REJECTED);
    });

    it('should only allow ADMIN', () => {
      expect(rule.allowedRoles).toEqual([UserRole.ADMIN]);
    });
  });

  describe('invalid transitions', () => {
    it('should not allow APPROVED → REJECTED', () => {
      const rule = SETTLEMENT_TRANSITIONS['REJECT'];
      expect(rule.fromStatus).not.toContain(SettlementStatus.APPROVED);
    });

    it('should not allow PAID → APPROVED', () => {
      const rule = SETTLEMENT_TRANSITIONS['APPROVE'];
      expect(rule.fromStatus).not.toContain(SettlementStatus.PAID);
    });

    it('should not allow REJECTED → APPROVED', () => {
      const rule = SETTLEMENT_TRANSITIONS['APPROVE'];
      expect(rule.fromStatus).not.toContain(SettlementStatus.REJECTED);
    });

    it('should not allow PENDING → PAID (must go through APPROVED)', () => {
      const rule = SETTLEMENT_TRANSITIONS['PAY'];
      expect(rule.fromStatus).not.toContain(SettlementStatus.PENDING);
    });
  });
});

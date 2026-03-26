import { CaseStatus, EventType, UserRole } from '@prisma/client';
import { CASE_TRANSITIONS, TransitionRule } from './case-state-machine';

describe('CASE_TRANSITIONS', () => {
  it('should define rules for all Flow A event types', () => {
    const expectedEvents = [
      EventType.CASE_CREATED,
      EventType.CASE_SUBMITTED,
      EventType.COC_SIGNED,
      EventType.INTAKE_CONFIRMED,
      EventType.CASE_CANCELLED,
    ];
    for (const evt of expectedEvents) {
      expect(CASE_TRANSITIONS[evt]).toBeDefined();
    }
  });

  describe('CASE_CREATED', () => {
    const rule = CASE_TRANSITIONS[EventType.CASE_CREATED];

    it('should have empty fromStatus (new creation)', () => {
      expect(rule.fromStatus).toEqual([]);
    });

    it('should transition to DRAFT', () => {
      expect(rule.toStatus).toBe(CaseStatus.DRAFT);
    });

    it('should allow OWNER, JUNKYARD, ADMIN', () => {
      expect(rule.allowedRoles).toContain(UserRole.OWNER);
      expect(rule.allowedRoles).toContain(UserRole.JUNKYARD);
      expect(rule.allowedRoles).toContain(UserRole.ADMIN);
    });

    it('should deny INTAKE_JUNKYARD, HUB, BUYER', () => {
      expect(rule.allowedRoles).not.toContain(UserRole.INTAKE_JUNKYARD);
      expect(rule.allowedRoles).not.toContain(UserRole.HUB);
      expect(rule.allowedRoles).not.toContain(UserRole.BUYER);
    });
  });

  describe('CASE_SUBMITTED', () => {
    const rule = CASE_TRANSITIONS[EventType.CASE_SUBMITTED];

    it('should only allow transition from DRAFT', () => {
      expect(rule.fromStatus).toEqual([CaseStatus.DRAFT]);
    });

    it('should transition to SUBMITTED', () => {
      expect(rule.toStatus).toBe(CaseStatus.SUBMITTED);
    });

    it('should allow OWNER, JUNKYARD, ADMIN', () => {
      expect(rule.allowedRoles).toContain(UserRole.OWNER);
      expect(rule.allowedRoles).toContain(UserRole.JUNKYARD);
      expect(rule.allowedRoles).toContain(UserRole.ADMIN);
    });

    it('should deny INTAKE_JUNKYARD, HUB, BUYER', () => {
      expect(rule.allowedRoles).not.toContain(UserRole.INTAKE_JUNKYARD);
      expect(rule.allowedRoles).not.toContain(UserRole.HUB);
      expect(rule.allowedRoles).not.toContain(UserRole.BUYER);
    });

    it('should not allow transition from non-DRAFT statuses', () => {
      const nonDraftStatuses = [
        CaseStatus.SUBMITTED,
        CaseStatus.IN_TRANSIT,
        CaseStatus.RECEIVED,
        CaseStatus.CANCELLED,
      ];
      for (const status of nonDraftStatuses) {
        expect(rule.fromStatus).not.toContain(status);
      }
    });
  });

  describe('COC_SIGNED', () => {
    const rule = CASE_TRANSITIONS[EventType.COC_SIGNED];

    it('should only allow transition from SUBMITTED', () => {
      expect(rule.fromStatus).toEqual([CaseStatus.SUBMITTED]);
    });

    it('should transition to IN_TRANSIT', () => {
      expect(rule.toStatus).toBe(CaseStatus.IN_TRANSIT);
    });

    it('should allow JUNKYARD, ADMIN', () => {
      expect(rule.allowedRoles).toContain(UserRole.JUNKYARD);
      expect(rule.allowedRoles).toContain(UserRole.ADMIN);
    });

    it('should deny OWNER, INTAKE_JUNKYARD, HUB, BUYER', () => {
      expect(rule.allowedRoles).not.toContain(UserRole.OWNER);
      expect(rule.allowedRoles).not.toContain(UserRole.INTAKE_JUNKYARD);
      expect(rule.allowedRoles).not.toContain(UserRole.HUB);
      expect(rule.allowedRoles).not.toContain(UserRole.BUYER);
    });

    it('should require signedBy and signedAt payload fields', () => {
      expect(rule.requiredPayloadFields).toContain('signedBy');
      expect(rule.requiredPayloadFields).toContain('signedAt');
    });
  });

  describe('INTAKE_CONFIRMED', () => {
    const rule = CASE_TRANSITIONS[EventType.INTAKE_CONFIRMED];

    it('should only allow transition from IN_TRANSIT', () => {
      expect(rule.fromStatus).toEqual([CaseStatus.IN_TRANSIT]);
    });

    it('should transition to RECEIVED', () => {
      expect(rule.toStatus).toBe(CaseStatus.RECEIVED);
    });

    it('should allow INTAKE_JUNKYARD, HUB, ADMIN', () => {
      expect(rule.allowedRoles).toContain(UserRole.INTAKE_JUNKYARD);
      expect(rule.allowedRoles).toContain(UserRole.HUB);
      expect(rule.allowedRoles).toContain(UserRole.ADMIN);
    });

    it('should deny OWNER, JUNKYARD, BUYER', () => {
      expect(rule.allowedRoles).not.toContain(UserRole.OWNER);
      expect(rule.allowedRoles).not.toContain(UserRole.JUNKYARD);
      expect(rule.allowedRoles).not.toContain(UserRole.BUYER);
    });

    it('should require receivedBy and receivedAt payload fields', () => {
      expect(rule.requiredPayloadFields).toContain('receivedBy');
      expect(rule.requiredPayloadFields).toContain('receivedAt');
    });
  });

  describe('CASE_CANCELLED', () => {
    const rule = CASE_TRANSITIONS[EventType.CASE_CANCELLED];

    it('should allow transition from DRAFT and SUBMITTED', () => {
      expect(rule.fromStatus).toContain(CaseStatus.DRAFT);
      expect(rule.fromStatus).toContain(CaseStatus.SUBMITTED);
    });

    it('should not allow cancellation from IN_TRANSIT, RECEIVED, etc.', () => {
      expect(rule.fromStatus).not.toContain(CaseStatus.IN_TRANSIT);
      expect(rule.fromStatus).not.toContain(CaseStatus.RECEIVED);
      expect(rule.fromStatus).not.toContain(CaseStatus.CANCELLED);
    });

    it('should transition to CANCELLED', () => {
      expect(rule.toStatus).toBe(CaseStatus.CANCELLED);
    });

    it('should allow OWNER, JUNKYARD, ADMIN', () => {
      expect(rule.allowedRoles).toContain(UserRole.OWNER);
      expect(rule.allowedRoles).toContain(UserRole.JUNKYARD);
      expect(rule.allowedRoles).toContain(UserRole.ADMIN);
    });

    it('should deny INTAKE_JUNKYARD, HUB, BUYER', () => {
      expect(rule.allowedRoles).not.toContain(UserRole.INTAKE_JUNKYARD);
      expect(rule.allowedRoles).not.toContain(UserRole.HUB);
      expect(rule.allowedRoles).not.toContain(UserRole.BUYER);
    });

    it('should require reason payload field', () => {
      expect(rule.requiredPayloadFields).toContain('reason');
    });
  });
});

describe('Transition validation helpers', () => {
  it('should reject transitions from invalid source statuses', () => {
    const rule = CASE_TRANSITIONS[EventType.COC_SIGNED];
    // COC_SIGNED only from SUBMITTED
    expect(rule.fromStatus.includes(CaseStatus.DRAFT)).toBe(false);
    expect(rule.fromStatus.includes(CaseStatus.IN_TRANSIT)).toBe(false);
    expect(rule.fromStatus.includes(CaseStatus.RECEIVED)).toBe(false);
    expect(rule.fromStatus.includes(CaseStatus.CANCELLED)).toBe(false);
  });

  it('should cover the full Flow A path: DRAFT → SUBMITTED → IN_TRANSIT → RECEIVED', () => {
    const submitted = CASE_TRANSITIONS[EventType.CASE_SUBMITTED];
    expect(submitted.fromStatus).toContain(CaseStatus.DRAFT);
    expect(submitted.toStatus).toBe(CaseStatus.SUBMITTED);

    const cocSigned = CASE_TRANSITIONS[EventType.COC_SIGNED];
    expect(cocSigned.fromStatus).toContain(submitted.toStatus);
    expect(cocSigned.toStatus).toBe(CaseStatus.IN_TRANSIT);

    const intake = CASE_TRANSITIONS[EventType.INTAKE_CONFIRMED];
    expect(intake.fromStatus).toContain(cocSigned.toStatus);
    expect(intake.toStatus).toBe(CaseStatus.RECEIVED);
  });
});

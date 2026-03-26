import { EventType } from '@prisma/client';

export const EVENT_LABELS: Record<string, string> = {
  [EventType.CASE_CREATED]: '케이스 생성',
  [EventType.CASE_SUBMITTED]: '접수 제출',
  [EventType.COC_SIGNED]: 'CoC 서명 완료',
  [EventType.INTAKE_CONFIRMED]: '입고 확인',
  [EventType.GRADING_SUBMITTED]: '등급 심사 완료',
  [EventType.LISTING_PUBLISHED]: '매물 등록',
  [EventType.PURCHASE_COMPLETED]: '구매 완료',
  [EventType.SETTLEMENT_CREATED]: '정산 생성',
  [EventType.SETTLEMENT_APPROVED]: '정산 승인',
  [EventType.CASE_CANCELLED]: '케이스 취소',
};

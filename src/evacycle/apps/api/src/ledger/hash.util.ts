import { createHash } from 'crypto';

export interface LedgerHashInput {
  caseId: string;
  seq: number;
  eventType: string;
  actorId: string;
  prevHash: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj as object)
      .sort()
      .reduce((acc, k) => ({ ...acc, [k]: sortObjectKeys((obj as any)[k]) }), {});
  }
  return obj;
}

export function computeSelfHash(input: LedgerHashInput): string {
  const sortedPayload = sortObjectKeys(input.payload);
  const canonical = [
    input.caseId,
    input.seq.toString(),
    input.eventType,
    input.actorId,
    input.prevHash,
    JSON.stringify(sortedPayload),
    input.createdAt.toISOString(),
  ].join('|');

  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

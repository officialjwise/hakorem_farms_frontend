import type { components } from '@hakorem/api-client';

export type ApprovalPending = components['schemas']['ApprovalPending'];

/**
 * A write the contract may answer with 202 `ApprovalPending` ("Nothing has taken effect yet") has both that
 * and the record in its type. Only the 202 body carries `summary` and `requestedAt`, so those two tell them
 * apart; a record's own `status` can also read PENDING_APPROVAL and is not the test.
 */
export function isApprovalPending(answer: unknown): answer is ApprovalPending {
  return (
    typeof answer === 'object' &&
    answer !== null &&
    'summary' in answer &&
    'requestedAt' in answer &&
    'approvalRequestId' in answer
  );
}

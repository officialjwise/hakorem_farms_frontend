/**
 * CR-059, marking a daily exception reviewed, as `docs/CONTRACT_REQUESTS.md` asks for it (ADR 0046, ADR 0053).
 * Not in the contract yet: the types are the request's, used only in a build switched on for CR-059, and this
 * file goes when the contract carries `reviewException` and `ExceptionItem.review`.
 *
 * The owner's rule (F12 brief, 2026-11-19): an Owner or a Manager marks an item reviewed with a note, and the
 * note stays on the item for whoever reads the report after them. Until the request lands the report says in
 * words that reviewing waits for the backend, and every item reads as not reviewed.
 */
import type { components, RequestedOperation } from '@hakorem/api-client';
import { createRequestedMutation } from '@hakorem/data';
import { consoleApi } from '../data/api';
import { requestedOn } from './switch';

type Schemas = components['schemas'];

/** `reviewException`: POST /exceptions/{id}/review with `{ note }`, answering the item with its `review`. */
export const REVIEW_EXCEPTION: RequestedOperation = {
  request: 'CR-059',
  operationId: 'reviewException',
  method: 'post',
  path: '/exceptions/{id}/review',
  permission: 'rpt.exceptions.review',
  idempotent: true,
  csrf: 'required',
  public: false,
  body: 'json',
  device: false,
};

/** `ExceptionReview`: who marked the item reviewed, when, and their note. */
export interface ExceptionReview {
  reviewedBy: Schemas['PrincipalRef'];
  reviewedAt: string;
  note: string;
}

/** `ExceptionItem` with CR-059's `review`: null until someone marks it reviewed. */
export type ReviewableExceptionItem = Schemas['ExceptionItem'] & {
  review?: ExceptionReview | null;
};

/** Whether this build can mark an item reviewed (CR-059's switch). */
export function exceptionReviewOn(): boolean {
  return requestedOn('CR-059');
}

/** The item's review, when the build reads CR-059's field and the server sent one. */
export function reviewOf(item: Schemas['ExceptionItem']): ExceptionReview | null {
  if (!exceptionReviewOn()) return null;
  return (item as ReviewableExceptionItem).review ?? null;
}

/** Built in the exception report's own module, which loads on demand (ADR 0053). */
const useRequestedMutation = createRequestedMutation(consoleApi);

/** Marks one item reviewed; the report and the header's list read again afterwards. */
export function useReviewException() {
  return useRequestedMutation<ReviewableExceptionItem>(REVIEW_EXCEPTION, {
    invalidates: ['getDailyExceptionReport', 'listExceptions'],
  });
}

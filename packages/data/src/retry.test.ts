import { ApiError, NetworkError } from '@hakorem/api-client';
import { retryDelay, shouldRetryMutation, shouldRetryQuery } from './retry';

const failure = (status: number, retryAfter?: number) =>
  new ApiError({ status, code: 'X', message: 'x', correlationId: 'c', retryAfter });

describe('retry policy', () => {
  it('retries a read twice for no answer and busy statuses', () => {
    for (const error of [
      new NetworkError(),
      new NetworkError('TIMEOUT'),
      failure(429),
      failure(502),
      failure(503),
      failure(504),
    ]) {
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(true);
      expect(shouldRetryQuery(2, error)).toBe(false);
    }
  });

  it('never retries what a person must act on, and never a 500', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 500]) {
      expect(shouldRetryQuery(0, failure(status))).toBe(false);
      expect(shouldRetryMutation(0, failure(status))).toBe(false);
    }
    expect(shouldRetryQuery(0, new Error('a bug'))).toBe(false);
  });

  it('retries a write only when nothing reached the server or a proxy was busy, at most twice', () => {
    expect(shouldRetryMutation(0, new NetworkError())).toBe(true);
    expect(shouldRetryMutation(1, failure(503))).toBe(true);
    expect(shouldRetryMutation(2, new NetworkError())).toBe(false);
  });

  it('backs off 1 s, 2 s, 4 s, 8 s and stops growing, or obeys Retry-After', () => {
    expect([0, 1, 2, 3, 4, 9].map((n) => retryDelay(n, new NetworkError()))).toEqual([
      1000, 2000, 4000, 8000, 8000, 8000,
    ]);
    expect(retryDelay(0, failure(429, 5))).toBe(5000);
    expect(retryDelay(0, failure(429, 900))).toBe(30000);
  });
});

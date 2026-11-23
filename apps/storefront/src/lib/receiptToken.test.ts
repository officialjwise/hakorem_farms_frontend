import { describe, expect, it } from 'vitest';
import { isReceiptToken } from './receiptToken';

describe('isReceiptToken', () => {
  it('takes base64url without padding, 22 to 86 characters', () => {
    expect(isReceiptToken('Hk7vN2kXc9TfL4mWb8Ry_-')).toBe(true);
    expect(isReceiptToken('a'.repeat(22))).toBe(true);
    expect(isReceiptToken('a'.repeat(86))).toBe(true);
  });

  it('refuses anything shorter, longer, padded or outside the alphabet', () => {
    expect(isReceiptToken('')).toBe(false);
    expect(isReceiptToken('a'.repeat(21))).toBe(false);
    expect(isReceiptToken('a'.repeat(87))).toBe(false);
    expect(isReceiptToken('Hk7vN2kXc9TfL4mWb8Ry==')).toBe(false);
    expect(isReceiptToken('Hk7vN2kXc9TfL4mWb8Ry+/')).toBe(false);
    expect(isReceiptToken('Hk7vN2kXc9TfL4mWb8Ry~.')).toBe(false);
    expect(isReceiptToken('Hk7vN2kXc9TfL4mWb8Ry %')).toBe(false);
    expect(isReceiptToken('Hk7vN2kXc9TfL4mWb8Ry\n')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  RECEIPT_TOKEN_PATTERN,
  newReceiptToken,
  receiptLink,
  templateUsable,
} from './receiptToken';

describe('the receipt token (2.24.0, CR-033)', () => {
  it('is 22 base64url characters from 16 random bytes, never the same twice', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newReceiptToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(RECEIPT_TOKEN_PATTERN);
      expect(token).toHaveLength(22);
    }
  });

  it('fills the template, and makes no link from anything but an https template with {token}', () => {
    expect(receiptLink('https://hakoremfarms.com/r/{token}', 'abc_DEF-123456789012345')).toBe(
      'https://hakoremfarms.com/r/abc_DEF-123456789012345',
    );
    expect(receiptLink('http://hakoremfarms.com/r/{token}', 'x'.repeat(22))).toBeNull();
    expect(receiptLink('https://hakoremfarms.com/r/{saleId}', 'x'.repeat(22))).toBeNull();
    expect(receiptLink('javascript:{token}', 'x'.repeat(22))).toBeNull();
    expect(receiptLink(null, 'x'.repeat(22))).toBeNull();
    expect(templateUsable('https://hakoremfarms.com/r/{token}')).toBe(true);
    expect(templateUsable(null)).toBe(false);
  });
});

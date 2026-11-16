import { afterEach, describe, expect, it } from 'vitest';
import { parseRequestedContract, requestedOn } from './switch';

describe('the requested-contract switch (ADR 0046)', () => {
  const before = process.env.HK_REQUESTED_CONTRACT;
  afterEach(() => {
    if (before === undefined) delete process.env.HK_REQUESTED_CONTRACT;
    else process.env.HK_REQUESTED_CONTRACT = before;
  });

  it('is off for every request when the variable is unset or empty', () => {
    expect(parseRequestedContract(undefined).size).toBe(0);
    expect(parseRequestedContract(' ').size).toBe(0);
    delete process.env.HK_REQUESTED_CONTRACT;
    expect(requestedOn('CR-032')).toBe(false);
  });

  it('switches on exactly the requests it names', () => {
    process.env.HK_REQUESTED_CONTRACT = 'CR-033';
    expect(requestedOn('CR-033')).toBe(true);
    expect(requestedOn('CR-032')).toBe(false);
    expect([...parseRequestedContract(' CR-032 , CR-033 ')]).toEqual(['CR-032', 'CR-033']);
  });

  it('refuses a request the console has no module for, naming it', () => {
    expect(() => parseRequestedContract('CR-032,CR-099')).toThrow(/CR-099/);
  });
});

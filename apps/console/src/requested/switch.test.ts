import { describe, expect, it } from 'vitest';
import { assertSwitchesAllowed, CONTRACT_REQUESTS, parseRequestedContract } from './switch';
import { LANDED_CHECKS } from './landed';

describe('the requested-contract switch (ADR 0046)', () => {
  it('is off for every request when the variable is unset or empty', () => {
    expect(parseRequestedContract(undefined).size).toBe(0);
    expect(parseRequestedContract(' ').size).toBe(0);
  });

  it('refuses a request the console has no module for, naming it', () => {
    expect(() => parseRequestedContract('CR-099')).toThrow(/CR-099/);
  });

  it('refuses every request that landed and has no switch any more, CR-059 the last (2.48.0)', () => {
    for (const landed of [
      'CR-034',
      'CR-042',
      'CR-046',
      'CR-032',
      'CR-050',
      'CR-033',
      'CR-063',
      'CR-059',
    ]) {
      expect(() => parseRequestedContract(landed)).toThrow(new RegExp(landed));
    }
  });
});

describe("the owner's conditions on ADR 0046", () => {
  it('fails a build for a real API with any switch named, naming it', () => {
    expect(() => assertSwitchesAllowed('CR-059', '/api/v1')).toThrow(/CR-059/);
    expect(() => assertSwitchesAllowed('CR-059', '/mock')).toThrow(/CR-059/);
  });

  it('lets every build through with every switch off', () => {
    expect(() => assertSwitchesAllowed(undefined, '/api/v1')).not.toThrow();
    expect(() => assertSwitchesAllowed('', 'https://api.hakoremfarms.com/v1')).not.toThrow();
    expect(() => assertSwitchesAllowed(undefined, '/mock')).not.toThrow();
  });

  it('checks every switch against the contract, so a landed request fails the type check', () => {
    expect(Object.keys(LANDED_CHECKS).sort()).toEqual([...CONTRACT_REQUESTS].sort());
  });
});

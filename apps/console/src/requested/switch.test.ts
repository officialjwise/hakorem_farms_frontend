import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSwitchesAllowed,
  CONTRACT_REQUESTS,
  parseRequestedContract,
  requestedOn,
} from './switch';
import { LANDED_CHECKS } from './landed';

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
    expect(requestedOn('CR-033')).toBe(false);
  });

  it('switches on exactly the requests it names', () => {
    process.env.HK_REQUESTED_CONTRACT = 'CR-033';
    expect(requestedOn('CR-033')).toBe(true);
    expect([...parseRequestedContract(' CR-033 ')]).toEqual(['CR-033']);
  });

  it('refuses a request the console has no module for, naming it', () => {
    expect(() => parseRequestedContract('CR-033,CR-099')).toThrow(/CR-099/);
  });

  it('refuses CR-034, CR-042, CR-046, CR-032 and CR-050, which landed and have no switch any more', () => {
    expect(() => parseRequestedContract('CR-033,CR-034')).toThrow(/CR-034/);
    expect(() => parseRequestedContract('CR-033,CR-042')).toThrow(/CR-042/);
    expect(() => parseRequestedContract('CR-033,CR-046')).toThrow(/CR-046/);
    expect(() => parseRequestedContract('CR-032,CR-033')).toThrow(/CR-032/);
    expect(() => parseRequestedContract('CR-033,CR-050')).toThrow(/CR-050/);
  });
});

describe("the owner's conditions on ADR 0046", () => {
  it('fails a build for a real API with any switch on, naming the switches', () => {
    expect(() => assertSwitchesAllowed('CR-033', '/api/v1')).toThrow(/CR-033.*\/api\/v1/);
    expect(() => assertSwitchesAllowed('CR-033', 'https://api.hakoremfarms.com/v1')).toThrow(
      /only in a build against \/mock/,
    );
    expect(() => assertSwitchesAllowed('CR-033', undefined)).toThrow(/no API/);
  });

  it('lets a build for a real API through with every switch off, and the mock build with them on', () => {
    expect(() => assertSwitchesAllowed(undefined, '/api/v1')).not.toThrow();
    expect(() => assertSwitchesAllowed('', 'https://api.hakoremfarms.com/v1')).not.toThrow();
    expect(() => assertSwitchesAllowed('CR-033', '/mock')).not.toThrow();
  });

  it('checks every switch against the contract, so a landed request fails the type check', () => {
    expect(Object.keys(LANDED_CHECKS).sort()).toEqual([...CONTRACT_REQUESTS].sort());
  });
});

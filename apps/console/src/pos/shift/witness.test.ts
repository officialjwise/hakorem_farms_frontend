import { describe, expect, it } from 'vitest';
import type { PinVerifier } from '../pin/pin';
import { asksForPin, mayRecord, serverDecides, witnessApprovers, witnessRule } from './witness';

const CASHIER = '019a7a86-ac02-78a8-ade0-935170bb0c2f';
const MANAGER = '019a7a86-4f35-7afd-b035-b8ab03a83188';

const verifier = (principalId: string, approves: PinVerifier['approves']): PinVerifier => ({
  principalId,
  displayName: principalId === MANAGER ? 'Kwabena Owusu' : 'Adwoa Darko',
  role: approves.length > 0 ? 'SUPERVISOR' : 'OPERATOR',
  version: 1,
  algorithm: 'PBKDF2-SHA256',
  iterations: 600_000,
  salt: 'c2FsdHNhbHRzYWx0c2FsdA==',
  hash: 'aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g=',
  approves,
  locked: false,
  wrongTries: 0,
});

const manager = { id: MANAGER, displayName: 'Kwabena Owusu' };
const pin = [verifier(MANAGER, ['CASH_DROP_WITNESS'])];

describe("a cash drop's witness is a supervisor's PIN on the till (owner, 2026-11-18)", () => {
  it('asks for no witness when the server says no supervisor is signed in at the branch', () => {
    const rule = witnessRule({ online: true, canAsk: true, signedIn: [], approvers: pin });
    expect(rule).toEqual({ kind: 'none-signed-in' });
    expect(asksForPin(rule)).toBe(false);
    expect(mayRecord(rule, false)).toBe(true);
    expect(serverDecides(rule)).toBe(false);
  });

  it("needs a supervisor's PIN when one is signed in: naming them is not enough", () => {
    const rule = witnessRule({ online: true, canAsk: true, signedIn: [manager], approvers: pin });
    expect(rule).toEqual({ kind: 'pin-required', signedIn: [manager] });
    expect(asksForPin(rule)).toBe(true);
    expect(mayRecord(rule, false)).toBe(false);
    expect(mayRecord(rule, true)).toBe(true);
  });

  it('records nothing while a supervisor is signed in and the till holds no supervisor PIN', () => {
    const rule = witnessRule({ online: true, canAsk: true, signedIn: [manager], approvers: [] });
    expect(rule.kind).toBe('no-pin-here');
    expect(asksForPin(rule)).toBe(false);
    expect(mayRecord(rule, false)).toBe(false);
  });

  it('waits for the answer, and asks again when it fails, before recording', () => {
    const asking = { online: true, canAsk: true, approvers: pin } as const;
    expect(witnessRule({ ...asking, signedIn: undefined }).kind).toBe('checking');
    expect(witnessRule({ ...asking, signedIn: 'failed' }).kind).toBe('read-failed');
    expect(mayRecord({ kind: 'checking' }, true)).toBe(false);
    expect(mayRecord({ kind: 'read-failed' }, true)).toBe(false);
  });

  it('offline, takes a PIN if a supervisor is there and otherwise lets the server decide', () => {
    const withPin = witnessRule({
      online: false,
      canAsk: false,
      signedIn: undefined,
      approvers: pin,
    });
    expect(withPin).toEqual({ kind: 'pin-optional', why: 'offline' });
    expect(mayRecord(withPin, false)).toBe(true);
    expect(serverDecides(withPin)).toBe(true);
    const noPin = witnessRule({ online: false, canAsk: false, signedIn: undefined, approvers: [] });
    expect(noPin).toEqual({ kind: 'unwitnessed-unknown', why: 'offline' });
    expect(asksForPin(noPin)).toBe(false);
    expect(serverDecides(noPin)).toBe(true);
  });

  it('online without the read (CR-050 off) cannot see who is signed in', () => {
    expect(
      witnessRule({ online: true, canAsk: false, signedIn: undefined, approvers: [] }),
    ).toEqual({ kind: 'unwitnessed-unknown', why: 'cannot-see' });
  });

  it("offers only a drop's witnesses, never the shift's own cashier", () => {
    const verifiers = [
      verifier(CASHIER, ['CASH_DROP_WITNESS']),
      verifier(MANAGER, ['CASH_DROP_WITNESS', 'OFFLINE_MOBILE_MONEY']),
      verifier('019a7a86-0000-7000-8000-000000000001', ['OFFLINE_MOBILE_MONEY']),
    ];
    expect(witnessApprovers(verifiers, CASHIER).map((v) => v.principalId)).toEqual([MANAGER]);
  });
});

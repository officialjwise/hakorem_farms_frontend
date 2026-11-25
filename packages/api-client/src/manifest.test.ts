import { describe, expect, it } from 'vitest';
import { operationManifest } from './generated/operations';
import { operationPermissions } from './generated/permissions';
import { packOperations, unpackOperations, type PackedRow } from './manifest';

const ROWS: Record<string, PackedRow> = {
  uploadFile: {
    method: 'post',
    path: '/files',
    idempotent: true,
    csrf: 'optional',
    public: false,
    body: 'multipart',
    device: false,
  },
  syncOfflineSales: {
    method: 'post',
    path: '/pos/sync',
    idempotent: true,
    csrf: 'required',
    public: false,
    body: 'json',
    device: true,
  },
  getPublicReceipt: {
    method: 'get',
    path: '/shop/receipts/{token}',
    idempotent: false,
    csrf: 'none',
    public: true,
    body: 'none',
    device: false,
  },
  updateThing: {
    method: 'patch',
    path: '/things/{id}',
    idempotent: true,
    csrf: 'required',
    public: false,
    body: 'json',
    device: false,
  },
  replaceThing: {
    method: 'put',
    path: '/things/{id}/all',
    idempotent: true,
    csrf: 'required',
    public: false,
    body: 'json',
    device: false,
  },
  deleteThing: {
    method: 'delete',
    path: '/things/{id}',
    idempotent: false,
    csrf: 'required',
    public: false,
    body: 'none',
    device: false,
  },
};

describe('the packed operation table (ADR 0059)', () => {
  it('unpacks to exactly the rows it packed, every method, flag, csrf and body', () => {
    expect(unpackOperations(packOperations(ROWS))).toEqual(ROWS);
  });

  it('refuses a path with white space, which would break a line', () => {
    const upload = ROWS['uploadFile'] as PackedRow;
    expect(() => packOperations({ bad: { ...upload, path: '/a b' } })).toThrow(/bad/);
  });

  it('the generated table reads as the contract says, with one permission per operation', () => {
    expect(operationManifest.syncOfflineSales).toEqual({
      method: 'post',
      path: '/pos/sync',
      idempotent: false,
      csrf: 'required',
      public: false,
      body: 'json',
      device: true,
    });
    expect(Object.keys(operationPermissions).sort()).toEqual(Object.keys(operationManifest).sort());
    expect(operationPermissions.listUsers).toBe('iam.user.read');
  });
});

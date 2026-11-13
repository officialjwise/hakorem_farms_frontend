import { renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import {
  isServerErrorEnvelope,
  mapServerErrors,
  pointerToFieldName,
  type ServerErrorEnvelope,
} from './serverErrors';

const envelope = (details: ServerErrorEnvelope['error']['details']): ServerErrorEnvelope => ({
  error: {
    code: 'VALIDATION_FAILED',
    message: 'The animal could not be saved.',
    correlationId: '0b6e0e1c-6c0f-4a35-9b8e-2a1f0d9d1c11',
    details,
  },
});

describe('pointerToFieldName', () => {
  it.each([
    ['/weightKg', 'weightKg'],
    ['/items/0/qty', 'items.0.qty'],
    ['/a~1b', 'a/b'],
    ['/a~0b', 'a~b'],
    ['/~01', '~1'],
    ['/~10', '/0'],
  ])('%s becomes %s', (pointer, name) => {
    expect(pointerToFieldName(pointer)).toBe(name);
  });

  it.each([[''], ['weightKg'], ['/'], ['/a//b'], ['/a.b'], ['/a[0]']])(
    '%j is not a form field',
    (pointer) => {
      expect(pointerToFieldName(pointer)).toBeNull();
    },
  );
});

describe('mapServerErrors', () => {
  function setup() {
    return renderHook(() =>
      useForm({
        defaultValues: {
          weightKg: '',
          tagNo: '',
          items: [{ qty: '' }],
          'a/b': '',
        },
      }),
    ).result.current;
  }

  it('sets a server error on each field the form has, and returns the rest with the reference', () => {
    const form = setup();
    const failure = mapServerErrors(
      envelope([
        { field: '/weightKg', code: 'OUT_OF_RANGE', message: 'Weight is above the scale limit.' },
        { field: '/items/0/qty', code: 'INVALID', message: 'Quantity must be positive.' },
        { field: '/a~1b', code: 'INVALID', message: 'Slash field is wrong.' },
        { field: '/nickname', code: 'UNKNOWN', message: 'Not a field of this form.' },
        { field: null, code: 'STOCK_HELD', message: 'This animal is under a withdrawal hold.' },
      ]),
      form,
    );

    expect(form.getFieldState('weightKg').error).toMatchObject({
      type: 'server',
      message: 'Weight is above the scale limit.',
    });
    expect(form.getFieldState('items.0.qty').error?.message).toBe('Quantity must be positive.');
    expect(form.getFieldState('a/b').error?.message).toBe('Slash field is wrong.');
    expect(form.getFieldState('tagNo').error).toBeUndefined();

    expect(failure.correlationId).toBe('0b6e0e1c-6c0f-4a35-9b8e-2a1f0d9d1c11');
    expect(failure.message).toBe('The animal could not be saved.');
    expect(failure.unmapped).toEqual([
      { field: '/nickname', code: 'UNKNOWN', message: 'Not a field of this form.' },
      { field: null, code: 'STOCK_HELD', message: 'This animal is under a withdrawal hold.' },
    ]);
  });

  it('returns no unmapped details when every detail lands on a field', () => {
    const form = setup();
    const failure = mapServerErrors(
      envelope([{ field: '/tagNo', code: 'DUPLICATE', message: 'That tag is already in use.' }]),
      form,
    );
    expect(failure.unmapped).toEqual([]);
  });
});

describe('isServerErrorEnvelope', () => {
  it('accepts the contract shape', () => {
    expect(isServerErrorEnvelope(envelope([]))).toBe(true);
  });

  it.each([
    [null],
    ['boom'],
    [new Error('boom')],
    [{ error: { code: 'X', message: 'm', correlationId: 'c' } }],
    [{ error: { code: 'X', message: 'm', correlationId: 'c', details: [{ field: 3 }] } }],
  ])('refuses %j', (value) => {
    expect(isServerErrorEnvelope(value)).toBe(false);
  });
});

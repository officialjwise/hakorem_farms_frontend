import { describe, expect, it } from 'vitest';
import storefront from '../../../../../packages/i18n/locales/en/storefront.json';
import type { Words } from '../../lib/words';
import {
  checkDetails,
  EMPTY_DETAILS,
  fieldOf,
  slotDay,
  toCheckoutStart,
  toCheckoutUpdate,
} from './details';

const words = storefront as unknown as Words;
const filled = {
  ...EMPTY_DETAILS,
  name: ' Ama Serwaa Ofori ',
  phone: '024 451 2876',
  line1: 'House 14, Ashaley Botwe Road',
  area: 'Madina',
  city: 'Accra',
  slotId: '019a7afd-16ee-736d-a8a6-3faf4a4fb88d',
};

describe('checkout details', () => {
  it('names what is missing before anything is sent', () => {
    const errors = checkDetails(EMPTY_DETAILS, words, true);
    expect(Object.keys(errors).sort()).toEqual([
      'area',
      'city',
      'line1',
      'name',
      'phone',
      'slotId',
    ]);
    expect(checkDetails({ ...filled, phone: '12' }, words, true).phone).toBe(
      'Enter a phone number such as 024 451 2876.',
    );
    expect(checkDetails(filled, words, true)).toEqual({});
  });

  it('collection asks for no address', () => {
    expect(
      checkDetails(
        { ...EMPTY_DETAILS, name: 'Kofi', phone: '0201234567', fulfilment: 'COLLECTION' },
        words,
        false,
      ),
    ).toEqual({});
  });

  it('builds the contract’s CheckoutStart: E.164 phones, the recipient defaulting to the contact', () => {
    expect(toCheckoutStart(filled)).toEqual({
      contactName: 'Ama Serwaa Ofori',
      contactPhone: '+233244512876',
      fulfilmentMode: 'DELIVERY',
      address: {
        recipientName: 'Ama Serwaa Ofori',
        recipientPhone: '+233244512876',
        line1: 'House 14, Ashaley Botwe Road',
        area: 'Madina',
        city: 'Accra',
        region: 'Greater Accra',
      },
      deliverySlotId: '019a7afd-16ee-736d-a8a6-3faf4a4fb88d',
      paymentTerms: 'PREPAID',
      differencePreference: 'REFUND',
    });
  });

  it('cash on delivery is COD terms; collection sends no address or slot', () => {
    const body = toCheckoutStart({ ...filled, fulfilment: 'COLLECTION', pay: 'COD' });
    expect(body.paymentTerms).toBe('COD');
    expect(body).not.toHaveProperty('address');
    expect(body).not.toHaveProperty('deliverySlotId');
  });

  it('an update carries no contact, which CheckoutUpdate does not take', () => {
    const update = toCheckoutUpdate(filled);
    expect(update).not.toHaveProperty('contactName');
    expect(update.deliverySlotId).toBe(filled.slotId);
  });

  it('maps the server’s field pointers onto the form', () => {
    expect(fieldOf('/address/area')).toBe('area');
    expect(fieldOf('/contactPhone')).toBe('phone');
    expect(fieldOf('/somethingElse')).toBeNull();
    expect(fieldOf(null)).toBeNull();
  });

  it('says a slot’s day in words', () => {
    expect(slotDay('2026-11-14', words)).toBe('Saturday 14 November');
    expect(slotDay('2027-01-01', words)).toBe('Friday 1 January');
  });
});

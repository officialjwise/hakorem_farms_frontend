import type { components } from '@hakorem/api-client';
import { toE164 } from '../../lib/phone';
import { fill, word, type Words } from '../../lib/words';

type S = components['schemas'];
export type PayMethod = 'MOBILE_MONEY' | 'CARD' | 'COD';

/** What the customer types at checkout, as typed. `toCheckoutStart` turns it into the contract's body. */
export interface Details {
  name: string;
  phone: string;
  fulfilment: 'DELIVERY' | 'COLLECTION';
  recipientName: string;
  recipientPhone: string;
  line1: string;
  area: string;
  city: string;
  region: string;
  digitalAddress: string;
  directions: string;
  slotId: string | null;
  pay: PayMethod;
  difference: 'REFUND' | 'STORE_CREDIT';
}

export const EMPTY_DETAILS: Details = {
  name: '',
  phone: '',
  fulfilment: 'DELIVERY',
  recipientName: '',
  recipientPhone: '',
  line1: '',
  area: '',
  city: '',
  region: 'Greater Accra',
  digitalAddress: '',
  directions: '',
  slotId: null,
  pay: 'MOBILE_MONEY',
  difference: 'REFUND',
};

export type DetailsErrors = Partial<Record<keyof Details, string>>;

/** The delivery address in the contract's shape, or null when a required part is missing or a phone is not one. */
export function toAddress(details: Details): S['AddressInput'] | null {
  const phone = toE164(
    details.recipientPhone.trim() === '' ? details.phone : details.recipientPhone,
  );
  const name = (details.recipientName.trim() === '' ? details.name : details.recipientName).trim();
  const required = [details.line1, details.area, details.city, details.region].map((v) => v.trim());
  if (phone === null || name === '' || required.includes('')) return null;
  return {
    recipientName: name,
    recipientPhone: phone,
    line1: details.line1.trim(),
    area: details.area.trim(),
    city: details.city.trim(),
    region: details.region.trim(),
    ...(details.digitalAddress.trim() === ''
      ? {}
      : { digitalAddress: details.digitalAddress.trim() }),
    ...(details.directions.trim() === '' ? {} : { directions: details.directions.trim() }),
  };
}

/** What is missing or wrong, in words, before anything is sent. The server checks it all again. */
export function checkDetails(details: Details, words: Words, slotsOpen: boolean): DetailsErrors {
  const required = word(words, 'checkout.details.required');
  const phoneWrong = word(words, 'checkout.details.phoneInvalid');
  const errors: DetailsErrors = {};
  if (details.name.trim() === '') errors.name = required;
  if (toE164(details.phone) === null)
    errors.phone = details.phone.trim() === '' ? required : phoneWrong;
  if (details.fulfilment === 'DELIVERY') {
    for (const key of ['line1', 'area', 'city', 'region'] as const) {
      if (details[key].trim() === '') errors[key] = required;
    }
    if (details.recipientPhone.trim() !== '' && toE164(details.recipientPhone) === null) {
      errors.recipientPhone = phoneWrong;
    }
    if (slotsOpen && details.slotId === null)
      errors.slotId = word(words, 'checkout.slots.required');
  }
  return errors;
}

/** The contract's CheckoutStart from what was typed. Call only once `checkDetails` found nothing. */
export function toCheckoutStart(details: Details): S['CheckoutStart'] {
  const delivery = details.fulfilment === 'DELIVERY';
  const address = delivery ? toAddress(details) : null;
  return {
    contactName: details.name.trim(),
    contactPhone: toE164(details.phone) ?? details.phone,
    fulfilmentMode: details.fulfilment,
    ...(address === null ? {} : { address }),
    ...(delivery && details.slotId !== null ? { deliverySlotId: details.slotId } : {}),
    paymentTerms: details.pay === 'COD' ? 'COD' : 'PREPAID',
    differencePreference: details.difference,
  };
}

/** The same changes for an open checkout (CheckoutUpdate takes no contact). */
export function toCheckoutUpdate(details: Details): S['CheckoutUpdate'] {
  const { address, deliverySlotId, paymentTerms, differencePreference } = toCheckoutStart(details);
  return {
    ...(address === undefined ? {} : { address }),
    ...(deliverySlotId === undefined ? {} : { deliverySlotId }),
    paymentTerms,
    differencePreference,
  };
}

/**
 * A field the server named in a CHECKOUT_INVALID refusal, as one of the form's fields: `/contactPhone`,
 * `/address/area`. Anything else stays with the form's own alert.
 */
export function fieldOf(pointer: string | null): keyof Details | null {
  if (pointer === null) return null;
  const map: Record<string, keyof Details> = {
    '/contactName': 'name',
    '/contactPhone': 'phone',
    '/address/recipientName': 'recipientName',
    '/address/recipientPhone': 'recipientPhone',
    '/address/line1': 'line1',
    '/address/area': 'area',
    '/address/city': 'city',
    '/address/region': 'region',
    '/address/digitalAddress': 'digitalAddress',
    '/address/directions': 'directions',
    '/deliverySlotId': 'slotId',
  };
  return map[pointer] ?? null;
}

/** A slot's day in words: "Saturday 14 November". The date is the contract's `format: date`, in Accra. */
export function slotDay(date: string, words: Words): string {
  const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10));
  const weekday = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  return fill(word(words, 'checkout.slots.day'), {
    weekday: word(words, `checkout.slots.weekdays.${weekday}`),
    day: String(day),
    month: word(words, `checkout.slots.months.${month}`),
  });
}

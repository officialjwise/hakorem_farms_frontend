import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Combobox,
  DatePicker,
  Field,
  Input,
  MutationFailure,
  formatDateTime,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';

type S = components['schemas'];

/** Today in Accra, which is UTC all year (ADR 0027), as a day. */
const today = () => new Date().toISOString().slice(0, 10);
/** A picked day as the instant it starts in Accra, 00:00Z (A-F4-03, as `startOfAccraDay`). */
const startOfAccraDay = (date: string) => `${date}T00:00:00Z`;

/**
 * A buyer found by name, phone or public id as the person types (at least two characters), from
 * `listCustomers`: a hotel or a chop bar that buys eggs by the crate.
 */
function BuyerPicker({
  value,
  onChange,
  error,
}: {
  value: S['Customer'] | null;
  onChange: (customer: S['Customer'] | null) => void;
  error?: string;
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const [text, setText] = useState(value?.name ?? '');
  const search = text.trim();
  // A list people search: `working`.
  const found = useApiQuery(
    'listCustomers',
    { query: { q: search, status: 'ACTIVE', limit: 10 } },
    { staleClass: 'working', enabled: search.length >= 2 && search !== value?.name },
  );
  const rows = [...(value === null ? [] : [value]), ...(found.data?.data ?? [])].filter(
    (c, i, all) => all.findIndex((d) => d.id === c.id) === i,
  );
  return (
    <Field
      label={t('buyer.customer')}
      required
      requiredLabel={t('common:field.required')}
      error={error}
    >
      <Combobox
        options={rows.map((c) => ({ value: c.id, label: `${c.name} (${c.publicId})` }))}
        value={value?.id ?? null}
        inputValue={text}
        onInputValueChange={setText}
        onValueChange={(id) => {
          const picked = rows.find((c) => c.id === id) ?? null;
          onChange(picked);
          if (picked !== null) setText(picked.name);
        }}
        listLabel={t('buyer.matches')}
        noResultsLabel={search.length < 2 ? t('buyer.typeMore') : t('buyer.noMatch')}
      />
    </Field>
  );
}

/**
 * Giving a buyer this list's prices (`assignCustomerPriceList`): the pricing engine reads a buyer's own
 * list first, so a hotel on it pays its crate price and its quantity breaks. A buyer has one list at a
 * time, and the new window replaces what it meets; the screen says so before it is sent. The answer stays
 * on screen in words. The contract has no read of who holds a list (CR-041), so only this answer is shown.
 */
export function AssignToBuyer({ list }: { list: S['PriceList'] }) {
  const { t } = useTranslation(['catalogue', 'common']);
  const auth = useAuth();
  const assign = useApiMutation('assignCustomerPriceList');
  const keyFor = useIntentKey();
  const [customer, setCustomer] = useState<S['Customer'] | null>(null);
  const [from, setFrom] = useState(today());
  const [until, setUntil] = useState('');
  const [replaces, setReplaces] = useState(false);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState<{ answer: S['PriceListAssignment']; name: string } | null>(null);
  const failure = useStateLabels({
    loading: t('buyer.saving'),
    emptyTitle: t('buyer.notSaved'),
    errorTitle: t('buyer.notSaved'),
    deniedTitle: t('buyer.denied'),
  });
  if (list.kind !== 'CUSTOMER' || !auth.can('mdm.price_list.assign')) return null;
  const required = t('common:field.required');
  const untilWrong = until !== '' && until <= from;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (customer === null || from === '' || untilWrong || !replaces) return;
    const name = customer.name;
    const input = {
      path: { id: customer.id },
      body: {
        priceListId: list.id,
        validFrom: startOfAccraDay(from),
        ...(until === '' ? {} : { validTo: startOfAccraDay(until) }),
      },
    };
    assign
      .mutateAsync(input, { idempotencyKey: keyFor(input) })
      .then((answer) => {
        setDone({ answer, name });
        setCustomer(null);
        setChecked(false);
        setReplaces(false);
      })
      .catch(() => undefined);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('buyer.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <p className="text-control-sm text-fg-muted">{t('buyer.intro')}</p>
          {done === null ? null : (
            <Alert
              severity="good"
              title={t('buyer.done', {
                name: done.name,
                list: done.answer.priceList.name,
                from: formatDateTime(done.answer.validFrom).slice(0, 10),
              })}
            >
              {done.answer.validTo === null
                ? t('buyer.openEnded')
                : t('buyer.endsOn', { until: formatDateTime(done.answer.validTo).slice(0, 10) })}
            </Alert>
          )}
          <MutationFailure error={assign.error} labels={failure} />
          <BuyerPicker
            value={customer}
            onChange={setCustomer}
            {...(checked && customer === null ? { error: required } : {})}
          />
          <Field
            label={t('buyer.from')}
            required
            requiredLabel={required}
            error={checked && from === '' ? required : undefined}
          >
            <DatePicker value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field
            label={t('buyer.until')}
            hint={t('buyer.untilHint')}
            error={checked && untilWrong ? t('buyer.untilWrong') : undefined}
          >
            <DatePicker value={until} onChange={(event) => setUntil(event.target.value)} />
          </Field>
          <Field
            label={t('buyer.replaces')}
            required
            requiredLabel={required}
            error={checked && !replaces ? t('buyer.replacesRequired') : undefined}
          >
            <Checkbox checked={replaces} onCheckedChange={(next) => setReplaces(next === true)} />
          </Field>
          <div>
            <Button type="submit" loading={assign.isPending} loadingLabel={t('buyer.saving')}>
              {t('buyer.save')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/**
 * A new price list for one buyer (`createPriceList`, kind `CUSTOMER`): a name, a code, and whether its
 * prices include tax. Its prices go in a draft version, which another person approves, and the list is
 * then given to the buyer.
 */
export function NewBuyerPriceList() {
  const { t } = useTranslation(['catalogue', 'common']);
  const auth = useAuth();
  const navigate = useNavigate();
  const create = useApiMutation('createPriceList', { invalidates: ['listPriceLists'] });
  const keyFor = useIntentKey();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [taxInclusive, setTaxInclusive] = useState(true);
  const [checked, setChecked] = useState(false);
  const failure = useStateLabels({
    loading: t('newBuyerList.saving'),
    emptyTitle: t('newBuyerList.notSaved'),
    errorTitle: t('newBuyerList.notSaved'),
    deniedTitle: t('newBuyerList.denied'),
  });
  if (!auth.can('mdm.price_list.create')) return null;
  if (!open) {
    return (
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {t('newBuyerList.open')}
        </Button>
      </div>
    );
  }
  const required = t('common:field.required');
  const codeOk = /^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code.trim());
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (name.trim() === '' || !codeOk) return;
    const body = {
      code: code.trim(),
      name: name.trim(),
      kind: 'CUSTOMER' as const,
      taxInclusive,
    };
    create
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then((made) => navigate(`/price-lists/${made.id}`))
      .catch(() => undefined);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('newBuyerList.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <p className="text-control-sm text-fg-muted">{t('newBuyerList.intro')}</p>
          <MutationFailure error={create.error} labels={failure} />
          <Field
            label={t('newBuyerList.name')}
            required
            requiredLabel={required}
            error={checked && name.trim() === '' ? required : undefined}
          >
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field
            label={t('newBuyerList.code')}
            hint={t('newBuyerList.codeHint')}
            required
            requiredLabel={required}
            error={checked && !codeOk ? t('newBuyerList.codeWrong') : undefined}
          >
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoComplete="off"
            />
          </Field>
          <Field label={t('newBuyerList.taxInclusive')} hint={t('newBuyerList.taxInclusiveHint')}>
            <Checkbox
              checked={taxInclusive}
              onCheckedChange={(next) => setTaxInclusive(next === true)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              loading={create.isPending}
              loadingLabel={t('newBuyerList.saving')}
            >
              {t('newBuyerList.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

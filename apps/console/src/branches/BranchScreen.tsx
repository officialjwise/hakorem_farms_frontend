import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, Pencil, Plus, Power } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { z } from 'zod';
import type { components, OperationInput } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Form,
  FormField,
  FormSubmitButton,
  Input,
  NOT_APPLICABLE,
  QueryBoundary,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';
import { BranchDialog } from './BranchDialog';
import { BranchStatusBadge } from './BranchesScreen';

type Branch = components['schemas']['Branch'];
type LocationKind = components['schemas']['LocationKind'];

/** The kinds a person creates by hand. The rest (in transit, loss, opening and so on) are the system's. */
const KINDS = [
  'SITE',
  'PEN',
  'COLD_ROOM',
  'STORE',
  'SHOP_FLOOR',
  'VEHICLE',
  'RETURNS_HOLD',
  'QUARANTINE',
] as const satisfies readonly LocationKind[];
const TEMPS = ['AMBIENT', 'CHILLED', 'FROZEN'] as const;

/**
 * One branch: its facts, edit, close or reopen, and its locations. Closing can be refused by the server, for
 * example when it is the last active branch; the screen does not guess, it shows the API's refusal in the
 * confirmation, in the API's words, with its reference (owner, 2026-11-15).
 */
export function BranchScreen() {
  const { t } = useTranslation(['branches', 'common']);
  const { id = '' } = useParams();
  const auth = useAuth();
  const branch = useApiQuery('getBranch', { path: { id } }, { staleClass: 'reference' });
  const labels = useStateLabels({
    loading: t('detail.loading'),
    emptyTitle: t('detail.error'),
    errorTitle: t('detail.error'),
    deniedTitle: t('list.denied'),
  });
  return (
    <QueryBoundary query={branch} labels={labels} isEmpty={() => false}>
      {(data) => <BranchView branch={data} canUpdate={auth.can('mdm.branch.update')} />}
    </QueryBoundary>
  );
}

function BranchView({ branch, canUpdate }: { branch: Branch; canUpdate: boolean }) {
  const { t } = useTranslation(['branches', 'common']);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const update = useApiMutation('updateBranch');
  const keyFor = useIntentKey();
  const closing = branch.status === 'ACTIVE';
  const next = closing ? 'CLOSED' : 'ACTIVE';
  const body: OperationInput<'updateBranch'>['body'] = { version: branch.version, status: next };

  return (
    <section aria-labelledby="branch-title" className="grid gap-4">
      <PageHeader
        title={branch.name}
        titleId="branch-title"
        description={<BranchStatusBadge status={branch.status} />}
        actions={
          canUpdate ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                {t('detail.edit')}
              </Button>
              <Button
                variant={closing ? 'danger' : 'primary'}
                onClick={() => {
                  update.reset();
                  setNotice(null);
                  setConfirming(true);
                }}
              >
                <Power aria-hidden="true" />
                {closing ? t('detail.close') : t('detail.reopen')}
              </Button>
            </>
          ) : undefined
        }
      />
      {notice === null ? null : <Alert severity="good" title={notice} />}
      <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        {(
          [
            ['code', <code key="c">{branch.code}</code>],
            ['address', branch.address ?? NOT_APPLICABLE],
            ['phone', branch.phone ?? NOT_APPLICABLE],
            ['test', branch.isTest ? t('detail.yes') : t('detail.no')],
            ['updated', <When key="u" instant={branch.updatedAt} />],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="grid gap-0.5">
            <dt className="text-control-sm text-fg-muted">{t(`detail.facts.${key}`)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <Locations branch={branch} />
      {editing ? (
        <BranchDialog
          branch={branch}
          onClose={() => setEditing(false)}
          onDone={(saved) => {
            setEditing(false);
            setNotice(t('detail.saved', { name: saved.name }));
          }}
        />
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          closing
            ? t('detail.closeTitle', { name: branch.name })
            : t('detail.reopenTitle', { name: branch.name })
        }
        body={closing ? t('detail.closeBody') : t('detail.reopenBody')}
        changes={[
          {
            label: t('detail.facts.status'),
            before: t(`status.${branch.status}`),
            after: t(`status.${next}`),
          },
        ]}
        consequence={closing ? t('detail.closeConsequence') : undefined}
        confirmLabel={closing ? t('detail.close') : t('detail.reopen')}
        pendingLabel={t('form.saving')}
        pending={update.isPending}
        destructive={closing}
        error={update.error}
        failedTitle={closing ? t('detail.notClosed') : t('detail.notReopened')}
        onConfirm={() => {
          update
            .mutateAsync({ path: { id: branch.id }, body }, { idempotencyKey: keyFor(body) })
            .then((saved) => {
              setConfirming(false);
              setNotice(
                saved.status === 'CLOSED'
                  ? t('detail.closed', { name: saved.name })
                  : t('detail.reopened', { name: saved.name }),
              );
            })
            // The refusal stays in the confirmation, from update.error, in the API's words.
            .catch(() => undefined);
        }}
      />
    </section>
  );
}

function Locations({ branch }: { branch: Branch }) {
  const { t } = useTranslation(['branches', 'common']);
  const auth = useAuth();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Locations change rarely: `reference`.
  const locations = useApiQuery(
    'listLocations',
    { query: { branchId: branch.id, limit: 100 } },
    { staleClass: 'reference' },
  );
  const labels = useStateLabels({
    loading: t('locations.loading'),
    emptyTitle: t('locations.empty'),
    emptyDescription: t('locations.emptyBody'),
    errorTitle: t('locations.error'),
    deniedTitle: t('locations.denied'),
  });
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('locations.columns.location')}</TableHead>
        <TableHead>{t('locations.columns.kind')}</TableHead>
        <TableHead>{t('locations.columns.sellable')}</TableHead>
        <TableHead>{t('locations.columns.temperature')}</TableHead>
      </TableRow>
    </TableHeader>
  );
  return (
    <section aria-labelledby="locations-title" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <h2 id="locations-title" className="text-lg font-semibold">
            {t('locations.title')}
          </h2>
          <p className="text-sm text-fg-muted">{t('locations.description')}</p>
        </div>
        {auth.can('mdm.location.create') && branch.status === 'ACTIVE' ? (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            {t('locations.add')}
          </Button>
        ) : null}
      </div>
      {notice === null ? null : <Alert severity="good" title={notice} />}
      <QueryBoundary
        query={locations}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('locations.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={4} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <TableContainer aria-label={t('locations.table')}>
            <Table>
              {header}
              <TableBody>
                {page.data.map((location) => (
                  <TableRow key={location.id}>
                    <TableRowHeader>
                      <span className="flex items-center gap-2">
                        <MapPin
                          aria-hidden="true"
                          className="size-icon-sm shrink-0 stroke-accent"
                        />
                        <span className="grid">
                          <span>{location.name}</span>
                          <code className="text-control-sm text-fg-muted">{location.code}</code>
                        </span>
                      </span>
                    </TableRowHeader>
                    <TableCell label={t('locations.columns.kind')}>
                      {t(`kind.${location.kind}`, { defaultValue: location.kind })}
                    </TableCell>
                    <TableCell label={t('locations.columns.sellable')}>
                      {location.isSellable ? t('detail.yes') : t('detail.no')}
                    </TableCell>
                    <TableCell label={t('locations.columns.temperature')}>
                      {location.tempClass === null
                        ? NOT_APPLICABLE
                        : t(`temp.${location.tempClass}`, { defaultValue: location.tempClass })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </QueryBoundary>
      {adding ? (
        <LocationDialog
          branch={branch}
          onClose={() => setAdding(false)}
          onDone={(name) => {
            setAdding(false);
            setNotice(t('locations.added', { name }));
          }}
        />
      ) : null}
    </section>
  );
}

/** A new location in this branch. Moving an existing location between branches waits on CR-014. */
function LocationDialog({
  branch,
  onClose,
  onDone,
}: {
  branch: Branch;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const { t } = useTranslation(['branches', 'common']);
  const required = t('common:field.required');
  const create = useApiMutation('createLocation');
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        code: z.string().trim().min(1, required),
        name: z.string().trim().min(1, required),
        kind: z.enum(KINDS),
        tempClass: z.enum(['NONE', ...TEMPS]),
        isSellable: z.boolean(),
      }),
    [required],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      kind: 'STORE' as (typeof KINDS)[number],
      tempClass: 'NONE' as 'NONE' | (typeof TEMPS)[number],
      isSellable: false,
    },
  });
  const toFailure = useWriteFailure(form);
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('locations.newTitle', { branch: branch.name })}
      description={t('locations.newBody')}
      closeLabel={t('common:actions.cancel')}
    >
      <Form
        form={form}
        className="grid gap-3 pb-2"
        onSubmit={async (values) => {
          setFailure(null);
          const body: OperationInput<'createLocation'>['body'] = {
            branchId: branch.id,
            code: values.code,
            name: values.name,
            kind: values.kind,
            isSellable: values.isSellable,
            ...(values.tempClass === 'NONE' ? {} : { tempClass: values.tempClass }),
          };
          await create.mutateAsync({ body }, { idempotencyKey: keyFor(body) });
          onDone(values.name);
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <WriteFailureView failure={failure} title={t('locations.notAdded')} />
        <FormField name="code" label={t('locations.fields.code')} required requiredLabel={required}>
          {(field) => <Input {...field} autoComplete="off" autoCapitalize="characters" />}
        </FormField>
        <FormField name="name" label={t('locations.fields.name')} required requiredLabel={required}>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormField>
        <FormField name="kind" label={t('locations.fields.kind')} required requiredLabel={required}>
          {(field) => (
            <Select
              ref={field.ref}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              options={KINDS.map((kind) => ({ value: kind, label: t(`kind.${kind}`) }))}
            />
          )}
        </FormField>
        <FormField name="tempClass" label={t('locations.fields.temperature')}>
          {(field) => (
            <Select
              ref={field.ref}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              options={[
                { value: 'NONE', label: t('temp.NONE') },
                ...TEMPS.map((temp) => ({ value: temp, label: t(`temp.${temp}`) })),
              ]}
            />
          )}
        </FormField>
        <FormField name="isSellable" label={t('locations.fields.sellable')}>
          {(field) => (
            <Checkbox
              ref={field.ref}
              name={field.name}
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        </FormField>
        <div className="flex justify-end">
          <FormSubmitButton loadingLabel={t('form.saving')}>
            {t('locations.create')}
          </FormSubmitButton>
        </div>
      </Form>
    </Dialog>
  );
}

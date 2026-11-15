import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, ShieldPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogActions,
  Form,
  FormField,
  FormSubmitButton,
  QueryBoundary,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
  Alert,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure, useStepUp } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { bothQueries, uniqueById, useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { useStateLabels } from '../lib/states';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';
import { When, type UserAccount } from './presentation';

type RoleGrant = components['schemas']['RoleGrant'];
const COLUMNS = 6;
const PAGE_OF_OPTIONS = 100;

/**
 * FR-IAM-011 and 022: a person's roles at branches. Its own read, its own four states: a manager who may see
 * the account but not its grants gets the grants' permission denied here while the rest of the page works.
 * The server decides (grants are scoped by branch, so the session's permission list is not the whole
 * answer), and `listGrants`' 403 is shown in words. Adding and revoking need step-up.
 */
export function GrantsSection({
  principal,
}: {
  principal: Pick<UserAccount, 'id' | 'displayName'>;
}) {
  const { t } = useTranslation(['iam', 'common']);
  const auth = useAuth();
  const grants = useApiQuery('listGrants', { query: { principalId: principal.id, limit: 100 } });
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<RoleGrant | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const revoke = useApiMutation('revokeGrant');
  const stepUp = useStepUp();
  const keyFor = useIntentKey();
  const manage = auth.can('iam.grant.manage');
  const labels = useStateLabels({
    loading: t('grants.loading'),
    emptyTitle: t('grants.empty'),
    emptyDescription: t('grants.emptyBody'),
    errorTitle: t('grants.error'),
    deniedTitle: t('grants.denied'),
  });
  const failureLabels = { ...labels, errorTitle: t('user.writeFailed') };

  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('grants.role')}</TableHead>
        <TableHead>{t('grants.branch')}</TableHead>
        <TableHead>{t('grants.validFrom')}</TableHead>
        <TableHead>{t('grants.validTo')}</TableHead>
        <TableHead>{t('grants.grantedBy')}</TableHead>
        <TableHead>
          <span className="sr-only">{t('grants.revokeShort')}</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <section aria-labelledby="grants-title">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle asChild>
            <h2 id="grants-title">{t('grants.title')}</h2>
          </CardTitle>
          {manage ? (
            <Button
              variant="secondary"
              onClick={() => {
                setDone(null);
                setAdding(true);
              }}
            >
              {t('grants.add')}
            </Button>
          ) : null}
        </CardHeader>
        <CardBody className="grid gap-3">
          <p className="text-control-sm text-fg-muted">{t('grants.intro')}</p>
          {done !== null ? <Alert severity={'good'} title={done} /> : null}
          <QueryBoundary
            query={grants}
            labels={labels}
            isEmpty={(page) => page.data.length === 0}
            loadingFallback={
              <TableContainer aria-labelledby="grants-title">
                <Table>
                  {header}
                  <TableBody>
                    <TableLoadingRows columns={COLUMNS} rows={2} label={labels.loading} />
                  </TableBody>
                </Table>
              </TableContainer>
            }
          >
            {(page) => (
              <TableContainer aria-labelledby="grants-title">
                <Table>
                  {header}
                  <TableBody>
                    {page.data.map((grant) => (
                      <TableRow key={grant.id}>
                        <TableRowHeader>{grant.role.name}</TableRowHeader>
                        <TableCell label={t('grants.branch')}>
                          {grant.branch.name}
                          {grant.location === null
                            ? ` · ${t('grants.anyLocation')}`
                            : ` · ${grant.location.name}`}
                        </TableCell>
                        <TableCell label={t('grants.validFrom')}>
                          <When instant={grant.validFrom} />
                        </TableCell>
                        <TableCell label={t('grants.validTo')}>
                          <When instant={grant.validTo} empty={t('grants.noEnd')} />
                        </TableCell>
                        <TableCell label={t('grants.grantedBy')}>
                          {grant.createdBy.displayName}
                        </TableCell>
                        <TableCell label={t('grants.revokeShort')}>
                          {manage ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label={t('grants.revoke', {
                                role: grant.role.name,
                                branch: grant.branch.name,
                              })}
                              onClick={() => {
                                revoke.reset();
                                setDone(null);
                                setRevoking(grant);
                              }}
                            >
                              {t('grants.revokeShort')}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </QueryBoundary>

          {revoking !== null ? (
            <ReasonDialog
              open
              onOpenChange={(next) => {
                if (!next) setRevoking(null);
              }}
              title={t('grants.revokeTitle')}
              body={t('grants.revokeBody', {
                name: principal.displayName,
                role: revoking.role.name,
                branch: revoking.branch.name,
              })}
              submitLabel={t('grants.revokeSubmit')}
              destructive
              error={shownFailure(revoke.error)}
              failureLabels={failureLabels}
              onConfirm={async (reason) => {
                const input = { path: { id: revoking.id }, body: { reason } };
                const answer = await stepUp.run(() =>
                  revoke.mutateAsync(input, { idempotencyKey: keyFor(input) }),
                );
                if (answer === null) return;
                setDone(t('grants.revoked'));
                setRevoking(null);
              }}
            />
          ) : null}
          {adding ? (
            <AddGrantDialog
              principalId={principal.id}
              onClose={() => setAdding(false)}
              onAdded={() => {
                setDone(t('grants.added'));
                setAdding(false);
              }}
            />
          ) : null}
          {stepUp.dialog}
        </CardBody>
      </Card>
    </section>
  );
}

function AddGrantDialog({
  principalId,
  onClose,
  onAdded,
}: {
  principalId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t } = useTranslation(['iam', 'common']);
  // Mounted only while the dialog is open, so the options are read only when someone adds a role.
  const roles = useApiQuery(
    'listRoles',
    { query: { limit: PAGE_OF_OPTIONS } },
    { staleClass: 'reference' },
  );
  const branches = useApiQuery(
    'listBranches',
    { query: { limit: PAGE_OF_OPTIONS } },
    { staleClass: 'reference' },
  );
  const labels = useStateLabels({
    loading: t('create.loadingOptions'),
    emptyTitle: t('create.optionsError'),
    errorTitle: t('create.optionsError'),
    deniedTitle: t('create.optionsDenied'),
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('grants.addTitle')}
      description={t('grants.addBody')}
      closeLabel={t('common:actions.cancel')}
      icon={ShieldPlus}
      requiredNote={t('common:field.requiredNote')}
    >
      <QueryBoundary
        query={bothQueries(roles, branches)}
        labels={labels}
        isEmpty={([r, b]) => r.data.length === 0 || b.data.length === 0}
        loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-32" />}
      >
        {([rolePage, branchPage]) => (
          <AddGrantForm
            principalId={principalId}
            onAdded={onAdded}
            onCancel={onClose}
            roles={uniqueById(rolePage.data).map((role) => ({ value: role.id, label: role.name }))}
            branches={uniqueById(branchPage.data)
              .filter((branch) => branch.status === 'ACTIVE')
              .map((branch) => ({ value: branch.id, label: `${branch.name} (${branch.code})` }))}
          />
        )}
      </QueryBoundary>
    </Dialog>
  );
}

function AddGrantForm({
  principalId,
  onAdded,
  onCancel,
  roles,
  branches,
}: {
  principalId: string;
  onAdded: () => void;
  onCancel: () => void;
  roles: { value: string; label: string }[];
  branches: { value: string; label: string }[];
}) {
  const { t } = useTranslation(['iam', 'common']);
  const create = useApiMutation('createGrant');
  const stepUp = useStepUp();
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        roleId: z.string().min(1, t('common:field.required')),
        branchId: z.string().min(1, t('common:field.required')),
      }),
    [t],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      roleId: '',
      branchId: branches.length === 1 ? (branches[0]?.value ?? '') : '',
    },
  });
  const toFailure = useWriteFailure(form);

  return (
    <>
      <Form
        form={form}
        className="grid gap-3 pb-2"
        onSubmit={async (values) => {
          setFailure(null);
          const body = { principalId, roleId: values.roleId, branchId: values.branchId };
          const answer = await stepUp.run(() =>
            create.mutateAsync({ body }, { idempotencyKey: keyFor(body) }),
          );
          if (answer !== null) onAdded();
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <WriteFailureView failure={failure} title={t('grants.addFailed')} />
        <FormField
          name="roleId"
          label={t('grants.role')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
        >
          {(field) => (
            <Select
              ref={field.ref}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={roles}
            />
          )}
        </FormField>
        <FormField
          name="branchId"
          label={t('grants.branch')}
          required
          requiredLabel={t('common:field.required')}
          requiredMark="asterisk"
        >
          {(field) => (
            <Select
              ref={field.ref}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={branches}
            />
          )}
        </FormField>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onCancel}>
          <FormSubmitButton loadingLabel={t('grants.addSubmit')}>
            <CircleCheck aria-hidden="true" />
            {t('grants.addSubmit')}
          </FormSubmitButton>
        </DialogActions>
      </Form>
      {stepUp.dialog}
    </>
  );
}

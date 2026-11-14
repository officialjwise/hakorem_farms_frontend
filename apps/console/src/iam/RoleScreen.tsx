import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import type { components, OperationInput } from '@hakorem/api-client';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  ErrorState,
  Form,
  FormField,
  FormFieldGroup,
  FormSubmitButton,
  Input,
  QueryBoundary,
  Skeleton,
  toggleInList,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useStepUp } from '../auth/StepUp';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';
import { groupPermissions, type PermissionGroup } from './permissions';

type Role = components['schemas']['Role'];
/** A role code as the seeded ones are written: OWNER, STOREKEEPER, FARM_HAND. */
const ROLE_CODE = /^[A-Z][A-Z0-9_]*$/;

/** FR-IAM-008: one role, its permissions grouped by area, and its edit (needs step-up, FR-IAM-022). */
export function RoleDetailScreen() {
  const { t } = useTranslation(['iam', 'common']);
  const { id = '' } = useParams();
  const role = useApiQuery('getRole', { path: { id } }, { staleClass: 'reference' });
  const labels = useStateLabels({
    loading: t('role.loading'),
    emptyTitle: t('role.notFound'),
    errorTitle: t('role.error'),
    deniedTitle: t('role.denied'),
  });
  const back = (
    <Link to="/roles" className="text-accent-text underline">
      {t('role.back')}
    </Link>
  );
  if (role.error?.status === 404) {
    return (
      <EmptyState
        title={t('role.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={role}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => (
        <RoleEditor
          key={current.version}
          current={current}
          back={back}
          onReload={() => void role.refetch()}
        />
      )}
    </QueryBoundary>
  );
}

/** FR-IAM-008: a role the owner adds. */
export function RoleNewScreen() {
  const { t } = useTranslation('iam');
  const back = (
    <Link to="/roles" className="text-accent-text underline">
      {t('role.back')}
    </Link>
  );
  return <RoleEditor current={null} back={back} onReload={() => undefined} />;
}

function RoleEditor({
  current: role,
  back,
  onReload,
}: {
  current: Role | null;
  back: ReactNode;
  onReload: () => void;
}) {
  const { t } = useTranslation(['iam', 'common']);
  const auth = useAuth();
  const canManage = auth.can('iam.role.manage');
  // The whole list, so a role is judged with every permission in view (ADR 0028). Seeded by migration:
  // `reference`.
  const permissions = useApiAllPages(
    'listPermissions',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const labels = useStateLabels({
    loading: t('role.loadingPermissions'),
    emptyTitle: t('role.permissionsError'),
    errorTitle: t('role.permissionsError'),
    deniedTitle: t('role.permissionsDenied'),
  });
  const title = role === null ? t('role.newTitle') : role.name;

  return (
    <article aria-labelledby="role-title" className="grid gap-4">
      <div className="grid gap-2">
        {back}
        <h1 id="role-title" className="text-2xl font-semibold">
          {title}
        </h1>
        {role !== null ? (
          <p className="text-fg-muted">
            <code>{role.code}</code> · {t('role.people', { count: role.userCount })}
          </p>
        ) : null}
        {role?.isSystem ? <p>{t('role.systemNote')}</p> : null}
        {role !== null && !canManage ? <p>{t('role.readOnly')}</p> : null}
      </div>
      <QueryBoundary
        query={permissions}
        labels={labels}
        isEmpty={(all) => all.items.length === 0}
        loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-96" />}
      >
        {(all) => {
          const groups = groupPermissions(all.items);
          const warning = all.truncated ? <ErrorState compact title={t('role.truncated')} /> : null;
          return canManage ? (
            <>
              {warning}
              <RoleForm current={role} groups={groups} onReload={onReload} />
            </>
          ) : role !== null ? (
            <>
              {warning}
              <RolePermissionsReadOnly current={role} groups={groups} />
            </>
          ) : null;
        }}
      </QueryBoundary>
    </article>
  );
}

function ModuleHeading({ id, module }: { id: string; module: PermissionGroup['module'] }) {
  const { t } = useTranslation('iam');
  return (
    <h3 id={id} className="text-base font-semibold">
      {t(`role.module.${module}`)}
      {module === 'other' ? null : (
        <span className="ms-2 text-control-sm font-normal text-fg-muted">{module}</span>
      )}
    </h3>
  );
}

function RolePermissionsReadOnly({
  current: role,
  groups,
}: {
  current: Role;
  groups: PermissionGroup[];
}) {
  const { t } = useTranslation('iam');
  const held = new Set(role.permissions);
  const shown = groups
    .map((group) => ({ ...group, permissions: group.permissions.filter((p) => held.has(p.code)) }))
    .filter((group) => group.permissions.length > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('role.permissions')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-4">
        {shown.map((group) => (
          <section
            key={group.module}
            aria-labelledby={`perm-${group.module}`}
            className="grid gap-1"
          >
            <ModuleHeading id={`perm-${group.module}`} module={group.module} />
            <ul className="grid gap-1 ps-4">
              {group.permissions.map((permission) => (
                <li key={permission.code} className="list-disc">
                  {permission.description} <code className="text-fg-muted">{permission.code}</code>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardBody>
    </Card>
  );
}

function RoleForm({
  current: role,
  groups,
  onReload,
}: {
  current: Role | null;
  groups: PermissionGroup[];
  onReload: () => void;
}) {
  const { t } = useTranslation(['iam', 'common']);
  const navigate = useNavigate();
  const create = useApiMutation('createRole');
  const update = useApiMutation('updateRole');
  const stepUp = useStepUp();
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .refine((v) => role !== null || ROLE_CODE.test(v), t('role.invalidCode')),
        name: z.string().trim().min(1, t('common:field.required')),
        requiresTotp: z.boolean(),
        permissions: z.array(z.string()).min(1, t('role.noPermissions')),
      }),
    [t, role],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: role?.code ?? '',
      name: role?.name ?? '',
      requiresTotp: role?.requiresTotp ?? false,
      permissions: role?.permissions ?? [],
    },
  });
  const toFailure = useWriteFailure(form);
  const guard = useLeaveGuard(form.formState.isDirty);

  return (
    <>
      <Form
        form={form}
        className="grid gap-4"
        onSubmit={async (values) => {
          setFailure(null);
          setSaved(false);
          if (role === null) {
            const body: OperationInput<'createRole'>['body'] = {
              code: values.code,
              name: values.name,
              requiresTotp: values.requiresTotp,
              permissions: values.permissions,
            };
            const answer = await stepUp.run(() =>
              create.mutateAsync({ body }, { idempotencyKey: keyFor(body) }),
            );
            if (answer === null) return;
            // The form is clean after a resolved submit, so this navigation is not blocked.
            form.reset(values);
            await navigate(`/roles/${answer.id}`, { replace: true });
            return;
          }
          const body: OperationInput<'updateRole'>['body'] = {
            version: role.version,
            name: values.name,
            requiresTotp: values.requiresTotp,
            permissions: values.permissions,
          };
          const input = { path: { id: role.id }, body };
          const answer = await stepUp.run(() =>
            update.mutateAsync(input, { idempotencyKey: keyFor(input) }),
          );
          if (answer !== null) setSaved(true);
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <WriteFailureView failure={failure} title={t('role.failed')} onReload={onReload} />
        {saved ? (
          <p role="status" className="font-semibold">
            {t('role.saved')}
          </p>
        ) : null}
        {role === null ? (
          <FormField
            name="code"
            label={t('role.code')}
            hint={t('role.codeHint')}
            required
            requiredLabel={t('common:field.required')}
          >
            {(field) => (
              <Input {...field} autoComplete="off" spellCheck={false} autoCapitalize="characters" />
            )}
          </FormField>
        ) : null}
        <FormField
          name="name"
          label={t('role.name')}
          required
          requiredLabel={t('common:field.required')}
        >
          {(field) => <Input {...field} autoComplete="off" />}
        </FormField>
        <FormField name="requiresTotp" label={t('role.requiresTotp')}>
          {(field) => (
            <Checkbox
              ref={field.ref}
              name={field.name}
              checked={field.value}
              onCheckedChange={(on) => field.onChange(on === true)}
              onBlur={field.onBlur}
            />
          )}
        </FormField>
        <FormFieldGroup
          name="permissions"
          label={t('role.permissions')}
          hint={t('role.permissionsHint')}
          required
          requiredLabel={t('common:field.required')}
        >
          {(field) => (
            <div className="grid gap-4">
              {groups.map((group) => (
                <div
                  key={group.module}
                  role="group"
                  aria-labelledby={`perm-${group.module}`}
                  className="grid gap-2"
                >
                  <ModuleHeading id={`perm-${group.module}`} module={group.module} />
                  {group.permissions.map((permission) => (
                    <Checkbox
                      key={permission.code}
                      label={permission.description}
                      hint={
                        permission.requiresStepUp
                          ? `${permission.code} · ${t('role.stepUpMark')}`
                          : permission.code
                      }
                      checked={field.value.includes(permission.code)}
                      onCheckedChange={(on) =>
                        field.onChange(toggleInList(field.value, permission.code, on === true))
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </FormFieldGroup>
        <div>
          <FormSubmitButton loadingLabel={role === null ? t('role.create') : t('role.save')}>
            {role === null ? t('role.create') : t('role.save')}
          </FormSubmitButton>
        </div>
      </Form>
      {stepUp.dialog}
      <LeaveGuardDialog guard={guard} />
    </>
  );
}

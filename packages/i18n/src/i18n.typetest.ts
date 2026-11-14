/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning key checking got looser.
 */
import { createI18n } from './index';

export async function keys() {
  const i18n = await createI18n({ namespaces: ['common'] });
  const ok: string = i18n.t('field.required');

  // @ts-expect-error a key that is not in the catalogue
  const missing = i18n.t('field.requird');

  // @ts-expect-error a namespace that does not exist
  await createI18n({ namespaces: ['storefront'] });

  return [ok, missing];
}

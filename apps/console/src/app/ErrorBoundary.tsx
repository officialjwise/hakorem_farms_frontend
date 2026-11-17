import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ErrorState } from '@hakorem/ui';
import { useReferenceCopy } from '../lib/RequestReference';

function Fallback({ reference }: { reference: string }) {
  const { t } = useTranslation('shell');
  const referenceCopy = useReferenceCopy();
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6">
      <ErrorState
        title={t('boundary.title')}
        description={t('boundary.body')}
        reference={reference}
        referenceLabel={t('boundary.reference')}
        referenceCopy={referenceCopy}
        action={<Button onClick={() => window.location.reload()}>{t('boundary.reload')}</Button>}
      />
    </main>
  );
}

/** The route-level fallback: react-router shows it for an error thrown while rendering or loading a route. */
export function RouteErrorFallback() {
  return <Fallback reference={newReference()} />;
}

function newReference(): string {
  const id = crypto.randomUUID();
  console.error(`[console] unhandled error, reference ${id}`);
  return id;
}

interface State {
  reference: string | null;
}

/**
 * The global error boundary: whatever a screen throws, the user gets words and a way out, never a blank
 * page. The reference is logged next to the error so a support call can find it. Reporting it to a
 * service is F13 (observability).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { reference: null };

  static getDerivedStateFromError(): State {
    return { reference: newReference() };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[console] render error', error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.reference === null ? (
      this.props.children
    ) : (
      <Fallback reference={this.state.reference} />
    );
  }
}

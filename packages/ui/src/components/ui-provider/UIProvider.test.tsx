import { render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { toastLabels } from '../../test/toastLabels';
import { UIProvider, usePortalContainer, useToast } from './UIProvider';

function PortalProbe() {
  const container = usePortalContainer();
  return container ? createPortal(<p>Portaled</p>, container) : null;
}

function silenceErrors() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

describe('UIProvider', () => {
  it('themes the app root and the portal target identically', () => {
    const { container } = render(
      <UIProvider theme="dark" density="compact" toastLabels={toastLabels}>
        <p>App</p>
      </UIProvider>,
    );
    for (const slot of ['ui-root', 'ui-portal']) {
      const el = container.querySelector(`[data-slot="${slot}"]`);
      expect(el).toHaveAttribute('data-theme', 'dark');
      expect(el).toHaveAttribute('data-density', 'compact');
    }
  });

  it('leaves data-theme off for the system theme, so the device preference applies', () => {
    const { container } = render(
      <UIProvider theme="system" density="comfortable" toastLabels={toastLabels}>
        <p>App</p>
      </UIProvider>,
    );
    expect(container.querySelector('[data-slot="ui-root"]')).not.toHaveAttribute('data-theme');
    expect(container.querySelector('[data-slot="ui-portal"]')).not.toHaveAttribute('data-theme');
  });

  it('portals into the themed target, outside the app root', () => {
    render(
      <UIProvider theme="dark" density="compact" toastLabels={toastLabels}>
        <PortalProbe />
      </UIProvider>,
    );
    const portaled = screen.getByText('Portaled');
    expect(portaled.closest('[data-slot="ui-portal"]')).not.toBeNull();
    expect(portaled.closest('[data-slot="ui-root"]')).toBeNull();
  });

  it('refuses a second, nested UIProvider', () => {
    const spy = silenceErrors();
    expect(() =>
      render(
        <UIProvider theme="light" density="comfortable" toastLabels={toastLabels}>
          <UIProvider theme="dark" density="compact" toastLabels={toastLabels}>
            <p>App</p>
          </UIProvider>
        </UIProvider>,
      ),
    ).toThrow(/already mounted/);
    spy.mockRestore();
  });

  it('refuses a portal lookup outside UIProvider', () => {
    const spy = silenceErrors();
    expect(() => render(<PortalProbe />)).toThrow(/inside UIProvider/);
    spy.mockRestore();
  });

  it('refuses a toast lookup outside UIProvider', () => {
    const spy = silenceErrors();
    function Probe() {
      useToast();
      return null;
    }
    expect(() => render(<Probe />)).toThrow(/useToast must be used inside UIProvider/);
    spy.mockRestore();
  });

  it('puts the toast viewport inside the themed portal target, named by the supplied label', () => {
    const { container } = render(
      <UIProvider theme="dark" density="compact" toastLabels={toastLabels}>
        <p>App</p>
      </UIProvider>,
    );
    const portal = container.querySelector('[data-slot="ui-portal"]');
    expect(portal?.querySelector('[aria-label^="Notifications"]')).not.toBeNull();
  });
});

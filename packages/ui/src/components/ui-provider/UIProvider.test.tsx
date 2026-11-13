import { render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { UIProvider, usePortalContainer } from './UIProvider';

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
      <UIProvider theme="dark" density="compact">
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
      <UIProvider theme="system" density="comfortable">
        <p>App</p>
      </UIProvider>,
    );
    expect(container.querySelector('[data-slot="ui-root"]')).not.toHaveAttribute('data-theme');
    expect(container.querySelector('[data-slot="ui-portal"]')).not.toHaveAttribute('data-theme');
  });

  it('portals into the themed target, outside the app root', () => {
    render(
      <UIProvider theme="dark" density="compact">
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
        <UIProvider theme="light" density="comfortable">
          <UIProvider theme="dark" density="compact">
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
});

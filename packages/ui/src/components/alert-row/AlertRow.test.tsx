import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Hourglass, PackageX } from 'lucide-react';
import { StatusBadge } from '../status-badge/StatusBadge';
import { AlertRow } from './AlertRow';
import { SlotLink } from '../../test/SlotLink';

describe('AlertRow', () => {
  it('says what, where and in what state, in words', () => {
    render(
      <AlertRow
        icon={PackageX}
        tone="critical"
        title="Broiler, whole"
        meta="Cold room"
        status={<StatusBadge tone="critical" icon={PackageX} label="Out of stock" />}
      />,
    );
    expect(screen.getByText('Broiler, whole')).toBeInTheDocument();
    expect(screen.getByText('Cold room')).toBeInTheDocument();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('becomes one link to the record, reachable by keyboard', async () => {
    render(
      <AlertRow asChild icon={Hourglass} title="Goat meat" meta="LOT-0412">
        <SlotLink href="/stock-units/1" />
      </AlertRow>,
    );
    await userEvent.tab();
    expect(screen.getByRole('link', { name: /Goat meat\s*LOT-0412/ })).toHaveFocus();
  });
});

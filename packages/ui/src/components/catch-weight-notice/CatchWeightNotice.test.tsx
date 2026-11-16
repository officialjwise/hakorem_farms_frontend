import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CatchWeightNotice } from './CatchWeightNotice';

describe('CatchWeightNotice', () => {
  it('is a region named by its title, with each figure and the rule in words', () => {
    render(
      <CatchWeightNotice
        title="Priced by weight"
        facts={[{ term: 'Price per kg', value: 'GH₵26.00' }]}
      >
        You pay for the weighed amount.
      </CatchWeightNotice>,
    );
    const region = screen.getByRole('region', { name: 'Priced by weight' });
    expect(region).toHaveTextContent('Price per kg');
    expect(region).toHaveTextContent('GH₵26.00');
    expect(region).toHaveTextContent('You pay for the weighed amount.');
  });

  it('refuses a blank title', () => {
    expect(() => render(<CatchWeightNotice title={' ' as 'x'} />)).toThrow(/non-empty title/);
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { makeBeach } from '../test/factories';
import { BeachCard } from './BeachCard';

describe('BeachCard', () => {
  it('renders the country alone when no municipality or region is recorded', () => {
    render(
      <MemoryRouter>
        <BeachCard beach={makeBeach()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Greece')).toBeInTheDocument();
    expect(screen.queryByText(/^,/)).not.toBeInTheDocument();
  });

  it('gives each recognition level its own badge class', () => {
    render(
      <MemoryRouter>
        <BeachCard beach={makeBeach({ recognition: 'disputed' })} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Disputed')).toHaveClass('badge-recognition-disputed');
  });
});

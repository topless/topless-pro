import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Beach } from '../types';
import { BeachCard } from './BeachCard';

const base: Beach = {
  id: 'beach',
  slug: 'example-beach',
  name: 'Example Beach',
  countryCode: 'GR',
  countryName: 'Greece',
  latitude: 35,
  longitude: 25,
  dressCode: 'topless-permitted',
  recognition: 'community-reported',
  confidence: 'medium',
  facilities: [],
};

describe('BeachCard', () => {
  it('renders the country alone when no municipality or region is recorded', () => {
    render(
      <MemoryRouter>
        <BeachCard beach={base} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Greece')).toBeInTheDocument();
    expect(screen.queryByText(/^,/)).not.toBeInTheDocument();
  });

  it('distinguishes recognition levels visually, with disputed marked loudest', () => {
    render(
      <MemoryRouter>
        <BeachCard beach={{ ...base, id: 'disputed', slug: 'disputed-beach', recognition: 'disputed' }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Disputed')).toHaveClass('badge-recognition-disputed');
  });

  it('renders an official designation with its own badge class', () => {
    render(
      <MemoryRouter>
        <BeachCard beach={{ ...base, id: 'official', slug: 'official-beach', recognition: 'official' }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Official designation')).toHaveClass('badge-recognition-official');
  });
});

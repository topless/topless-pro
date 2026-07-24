import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBeaches } from '../lib/api';
import type { Beach } from '../types';
import { HomePage } from './HomePage';

vi.mock('../lib/api', () => ({
  getBeaches: vi.fn(),
}));

const beaches: Beach[] = [
  {
    id: 'unknown',
    slug: 'mystery-beach',
    name: 'Mystery Beach',
    countryCode: 'GR',
    countryName: 'Greece',
    latitude: 37,
    longitude: 25,
    dressCode: 'unknown',
    recognition: 'disputed',
    confidence: 'low',
    facilities: [],
  },
  {
    id: 'official',
    slug: 'official-beach',
    name: 'Official Beach',
    countryCode: 'FR',
    countryName: 'France',
    latitude: 43,
    longitude: 3,
    dressCode: 'nudity-permitted',
    recognition: 'official',
    confidence: 'high',
    facilities: ['Toilets'],
  },
];

describe('HomePage', () => {
  beforeEach(() => {
    vi.mocked(getBeaches).mockResolvedValue(beaches);
  });

  it('loads the directory and exposes the unknown classification filter', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Mystery Beach')).toBeInTheDocument();
    expect(screen.getByText('Official Beach')).toBeInTheDocument();

    const unknownFilter = screen.getByRole('button', { name: 'Unknown' });
    fireEvent.click(unknownFilter);

    expect(unknownFilter).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Mystery Beach')).toBeInTheDocument();
    expect(screen.queryByText('Official Beach')).not.toBeInTheDocument();
  });

  it('shows the verification launch state only after an empty directory loads', async () => {
    vi.mocked(getBeaches).mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('heading', { name: 'The first beach guides are being checked.' })).not.toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'The first beach guides are being checked.' })).toBeInTheDocument();
    expect(screen.getByText('Directory in verification')).toBeInTheDocument();
    expect(screen.getByText('No beaches are published yet')).toBeInTheDocument();
    expect(screen.getByText('Unknown or disputed')).toBeInTheDocument();
  });

  it('keeps an API failure distinct from an empty directory', async () => {
    vi.mocked(getBeaches).mockRejectedValueOnce(new Error('Unavailable'));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('We could not load the directory. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Directory unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'The first beach guides are being checked.' })).not.toBeInTheDocument();
  });
});

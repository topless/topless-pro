import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBeaches } from '../lib/api';
import { makeBeach } from '../test/factories';
import { HomePage } from './HomePage';

vi.mock('../lib/api', () => ({
  getBeaches: vi.fn(),
}));

const beaches = [
  makeBeach({ slug: 'mystery-beach', name: 'Mystery Beach', dressCode: 'unknown', recognition: 'disputed', confidence: 'low' }),
  makeBeach({ slug: 'official-beach', name: 'Official Beach', countryCode: 'FR', countryName: 'France', dressCode: 'nudity-permitted', recognition: 'official', confidence: 'high', facilities: ['Toilets'] }),
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

  it('matches unaccented search queries against accented beach names', async () => {
    vi.mocked(getBeaches).mockResolvedValueOnce([
      makeBeach({ slug: 'kallithea', name: 'Kallithéa' }),
    ]);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Kallithéa')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search by beach, town or country'), {
      target: { value: 'kallithea' },
    });
    expect(screen.getByText('Kallithéa')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search by beach, town or country'), {
      target: { value: 'somewhere-else' },
    });
    expect(screen.queryByText('Kallithéa')).not.toBeInTheDocument();
  });

  it('shows the verification launch state only after an empty directory loads', async () => {
    vi.mocked(getBeaches).mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('heading', { name: 'A beach is listed only when we can show the evidence.' })).not.toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'A beach is listed only when we can show the evidence.' })).toBeInTheDocument();
    expect(screen.getByText('Before launch')).toBeInTheDocument();
    expect(screen.getByText('No beaches are published yet')).toBeInTheDocument();
    expect(screen.getByText('What to wear')).toBeInTheDocument();
    expect(screen.getByText('How established it is')).toBeInTheDocument();
    expect(screen.getByText('Disputed')).toHaveClass('recog-disputed');
    // No dead controls while nothing is published.
    expect(screen.queryByRole('group', { name: 'Filter by what to wear' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('keeps an API failure distinct from an empty directory and offers a retry', async () => {
    vi.mocked(getBeaches).mockRejectedValueOnce(new Error('Unavailable'));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load the directory. Please try again.');
    expect(screen.getByText('Directory unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'A beach is listed only when we can show the evidence.' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Mystery Beach')).toBeInTheDocument();
  });

  it('lets a visitor clear a filter that matches nothing', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await screen.findByText('Mystery Beach');
    fireEvent.click(screen.getByRole('button', { name: 'Swimwear expected' }));
    expect(screen.getByText('No beaches match those filters yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all beaches' }));
    expect(screen.getByText('Mystery Beach')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All beaches' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sets the document title', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await screen.findByText('Mystery Beach');
    await waitFor(() => expect(document.title).toBe('topless.pro — Beach dress codes: official, tolerated or disputed'));
  });
});

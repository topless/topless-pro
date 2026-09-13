import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBeaches } from '../lib/api';
import { makeBeach } from '../test/factories';
import { MapPage } from './MapPage';

vi.mock('../lib/api', () => ({
  getBeaches: vi.fn(),
}));

// No coastline files in tests: the loads never settle and nothing has arrived.
vi.mock('../lib/basemap', () => ({
  loadWorld: vi.fn(() => new Promise(() => {})),
  loadDetail: vi.fn(() => new Promise(() => {})),
  loadTile: vi.fn(() => new Promise(() => {})),
  peekWorld: () => undefined,
  peekDetail: () => undefined,
  peekTile: () => undefined,
  tilesInView: () => [],
  tileRect: () => [0, 0, 1, 1],
}));

const beaches = [
  makeBeach({ slug: 'plaka', name: 'Plaka', region: 'Naxos', latitude: 37.03, longitude: 25.37, dressCode: 'nudity-permitted', recognition: 'tolerated' }),
  makeBeach({ slug: 'levant', name: 'Île du Levant', countryCode: 'FR', countryName: 'France', latitude: 43.02, longitude: 6.46, dressCode: 'clothing-optional', recognition: 'official' }),
];

function ShowLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderMap(entry = '/map') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MapPage />
      <ShowLocation />
    </MemoryRouter>,
  );
}

describe('MapPage', () => {
  beforeEach(() => {
    vi.mocked(getBeaches).mockResolvedValue(beaches);
    // jsdom lays nothing out and has no canvas; give the frame a size and a silent context.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows one pin per listed beach with an accessible name', async () => {
    renderMap();
    expect(await screen.findByRole('button', { name: 'Plaka, Naxos, Greece — Nudity accepted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Île du Levant, France — Clothing optional' })).toBeInTheDocument();
    expect(screen.getByText('2 beaches shown')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Map of listed beaches — topless.pro'));
  });

  it('opens a card for a selected pin, links to the listing and closes again', async () => {
    renderMap();
    fireEvent.click(await screen.findByRole('button', { name: 'Plaka, Naxos, Greece — Nudity accepted' }));

    const card = screen.getByRole('complementary', { name: 'Selected beach' });
    expect(card).toHaveTextContent('Plaka');
    expect(card).toHaveTextContent('Local custom');
    expect(screen.getByRole('link', { name: /Open the listing/ })).toHaveAttribute('href', '/beaches/plaka');
    expect(screen.getByTestId('location')).toHaveTextContent('?beach=plaka');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary', { name: 'Selected beach' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('');
  });

  it('opens on the beach a link names', async () => {
    renderMap('/map?beach=levant');
    expect(await screen.findByRole('complementary', { name: 'Selected beach' })).toHaveTextContent('Île du Levant');
    expect(screen.getByRole('button', { name: 'Île du Levant, France — Clothing optional' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters the pins by dress code and keeps the filter in the address', async () => {
    renderMap();
    await screen.findByRole('button', { name: 'Plaka, Naxos, Greece — Nudity accepted' });

    fireEvent.click(screen.getByRole('button', { name: 'Clothing optional' }));
    expect(screen.queryByRole('button', { name: /^Plaka/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Île du Levant/ })).toBeInTheDocument();
    expect(screen.getByText('1 beach shown')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('?dress=clothing-optional');
  });

  it('groups neighbouring beaches and separates them when the group is selected', async () => {
    vi.mocked(getBeaches).mockResolvedValueOnce([
      makeBeach({ slug: 'a', name: 'Cove A', latitude: 37.030, longitude: 25.370 }),
      makeBeach({ slug: 'b', name: 'Cove B', latitude: 37.034, longitude: 25.374 }),
    ]);
    renderMap();

    const group = await screen.findByRole('button', { name: '2 beaches here — zoom in' });
    fireEvent.click(group);
    expect(await screen.findByRole('button', { name: /^Cove A/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Cove B/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/\?z=11\.00&lat=37\.03\d+&lon=25\.37\d+/));
  });

  it('starts from a view given in the address and records zooming', async () => {
    renderMap('/map?z=5&lat=38&lon=24');
    await screen.findByRole('button', { name: /^Plaka/ });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?z=6.00&lat=38.0000&lon=24.0000'));
  });

  it('keeps an API failure distinct from an empty directory and offers a retry', async () => {
    vi.mocked(getBeaches).mockRejectedValueOnce(new Error('Unavailable'));
    renderMap();

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load the directory. Please try again.');
    expect(screen.queryByRole('application')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /^Plaka/ })).toBeInTheDocument();
  });
});

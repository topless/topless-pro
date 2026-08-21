import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getBeach, submitCorrection } from '../lib/api';
import { makeBeach } from '../test/factories';
import { BeachPage } from './BeachPage';

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  getBeach: vi.fn(),
  submitCorrection: vi.fn(),
}));

const beach = makeBeach({ region: 'Crete', recognition: 'tolerated', facilities: ['Showers'], lastVerifiedAt: '2026-07-21' });

async function renderAndSubmit(message = 'The posted guidance changed this week.') {
  render(
    <MemoryRouter initialEntries={['/beaches/example-beach']}>
      <Routes>
        <Route path="/beaches/:slug" element={<BeachPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Example Beach' });
  fireEvent.change(screen.getByLabelText('What did you see, and when?'), {
    target: { value: message },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit correction' }));
}

describe('BeachPage', () => {
  beforeEach(() => {
    vi.mocked(getBeach).mockResolvedValue(beach);
    vi.mocked(submitCorrection).mockResolvedValue();
  });

  it('loads one beach and submits the protected correction form', async () => {
    render(
      <MemoryRouter initialEntries={['/beaches/example-beach']}>
        <Routes>
          <Route path="/beaches/:slug" element={<BeachPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Example Beach' })).toBeInTheDocument();
    expect(getBeach).toHaveBeenCalledWith('example-beach');
    await waitFor(() => expect(document.title).toBe('Example Beach, Crete: Topless accepted — topless.pro'));
    expect(screen.getByText('21 July 2026').closest('time')).toHaveAttribute('dateTime', '2026-07-21');
    expect(screen.getByRole('link', { name: /Open in maps/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=35,25',
    );
    expect(screen.getByRole('heading', { name: 'What this means' })).toBeInTheDocument();
    // The label appears twice: as the chip and again in "What this means".
    expect(screen.getAllByText('Topless accepted')[0]).toHaveClass('chip-topless-permitted');

    fireEvent.change(screen.getByLabelText(/Email \(optional\)/), {
      target: { value: 'traveller@example.com' },
    });
    fireEvent.change(screen.getByLabelText('What did you see, and when?'), {
      target: { value: 'The posted guidance changed this week.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit correction' }));

    await waitFor(() => {
      expect(submitCorrection).toHaveBeenCalledWith({
        beachSlug: 'example-beach',
        email: 'traveller@example.com',
        message: 'The posted guidance changed this week.',
        website: '',
      });
    });
    expect(await screen.findByRole('status')).toHaveTextContent('check it before changing anything');
  });

  it('tells a rate-limited visitor to wait instead of retrying immediately', async () => {
    vi.mocked(submitCorrection).mockRejectedValueOnce(
      new ApiError(429, 'Too many corrections. Please try again later.'),
    );

    await renderAndSubmit();

    expect(await screen.findByRole('status')).toHaveTextContent('wait a minute');
  });

  it('surfaces server validation messages on rejected corrections', async () => {
    vi.mocked(submitCorrection).mockRejectedValueOnce(new ApiError(400, 'Invalid email'));

    await renderAndSubmit();

    expect(await screen.findByRole('status')).toHaveTextContent('Invalid email');
  });

});

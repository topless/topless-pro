import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBeach, submitCorrection } from '../lib/api';
import type { Beach } from '../types';
import { BeachPage } from './BeachPage';

vi.mock('../lib/api', () => ({
  getBeach: vi.fn(),
  submitCorrection: vi.fn(),
}));

const beach: Beach = {
  id: 'beach',
  slug: 'example-beach',
  name: 'Example Beach',
  countryCode: 'GR',
  countryName: 'Greece',
  region: 'Crete',
  latitude: 35,
  longitude: 25,
  dressCode: 'topless-permitted',
  recognition: 'tolerated',
  confidence: 'medium',
  facilities: ['Showers'],
};

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

    fireEvent.change(screen.getByLabelText('Email (optional)'), {
      target: { value: 'traveller@example.com' },
    });
    fireEvent.change(screen.getByLabelText('What should we update?'), {
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
    expect(await screen.findByRole('status')).toHaveTextContent('ready for review');
  });
});

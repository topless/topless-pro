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

  it('encodes dress code as a filled chip and recognition as a glyph label', () => {
    render(
      <MemoryRouter>
        <BeachCard beach={makeBeach({ recognition: 'disputed', dressCode: 'nudity-permitted' })} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Nudity accepted')).toHaveClass('chip-nudity-permitted');
    expect(screen.getByText('Disputed')).toHaveClass('recog-disputed');
    expect(screen.getByRole('link', { name: 'Example Beach' })).toHaveAttribute('href', '/beaches/example-beach');
  });
});

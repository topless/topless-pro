import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './Layout';

function Page({ name }: { name: string }) {
  const navigate = useNavigate();
  return (
    <>
      <h1>{name}</h1>
      <button onClick={() => navigate('/other')}>Go forward</button>
      <button onClick={() => navigate(-1)}>Go back</button>
    </>
  );
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Layout>
        <Routes>
          <Route path="/" element={<Page name="Home" />} />
          <Route path="/other" element={<Page name="Other" />} />
        </Routes>
      </Layout>
    </MemoryRouter>,
  );
}

describe('Layout navigation', () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('scrollTo', scrollTo);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not reset scroll or focus on first render', () => {
    renderApp();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it('resets scroll and moves focus to main on forward navigation only', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Go forward' }));
    expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.activeElement).toBe(screen.getByRole('main'));

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    // Back is left to the per-entry scroll restore, not forced to the top.
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});

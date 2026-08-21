import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation, useNavigationType } from 'react-router-dom';
import { rememberScroll } from '../lib/scroll-memory';

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
  const previousKey = useRef(location.key);

  // Keep the current entry's scroll position so Back can return to it once
  // the page's data has rendered (see useRestoreScroll). The browser's own
  // restoration is switched off because it fires before async content exists.
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const save = () => rememberScroll(location.key);
    save();
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [location.key]);

  // Forward navigation (a tap on a row) opens the new page at the top with
  // focus at the start of the content. Back/Forward are left to the per-entry
  // restore. Comparing history keys, not counting renders, survives
  // StrictMode's effect re-run.
  useEffect(() => {
    if (previousKey.current === location.key) return;
    previousKey.current = location.key;
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [location.key, navigationType]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="topless.pro home">
          <span aria-hidden="true">topless<span className="brand-tld">.pro</span></span>
          <small>Beach dress-code reference</small>
        </Link>
        <Link className="header-link" to="/about">About</Link>
      </header>
      <main ref={mainRef} tabIndex={-1}>{children}</main>
      <footer>
        <strong>Rules, custom and hearsay — kept apart.</strong>
        <p>Rules and customs change. Follow posted signs and local authorities.</p>
      </footer>
    </div>
  );
}

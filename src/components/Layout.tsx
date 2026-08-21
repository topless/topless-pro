import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Client-side navigation keeps the previous scroll position and leaves
  // focus on the removed element; reset both so a tap on a row opens the
  // beach page at the top with focus at the start of the new content.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="topless.pro home">
          <span aria-hidden="true">topless<span>.pro</span></span>
          <small>Beach dress-code reference</small>
        </Link>
        <Link className="header-link" to="/about">About</Link>
      </header>
      <main ref={mainRef} tabIndex={-1}>{children}</main>
      <footer>
        <strong>Know before you go.</strong>
        <p>Rules and customs change. Follow posted signs and local authorities.</p>
      </footer>
    </div>
  );
}

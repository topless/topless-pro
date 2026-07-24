import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="topless.pro home">
          topless<span>.pro</span>
        </Link>
        <Link className="header-link" to="/about">About</Link>
      </header>
      <main>{children}</main>
      <footer>
        <strong>Know before you go.</strong>
        <p>Rules and customs change. Follow posted signs and local authorities.</p>
      </footer>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/document-title';

export function NotFoundPage() {
  useDocumentTitle('Page not found — topless.pro');

  return (
    <section className="content-page">
      <p className="eyebrow">Page not found</p>
      <h1>That page doesn’t exist.</h1>
      <Link className="back-link" to="/">Return to the directory</Link>
    </section>
  );
}

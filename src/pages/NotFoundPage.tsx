import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="content-page">
      <p className="eyebrow">Page not found</p>
      <h1>That page doesn’t exist.</h1>
      <Link to="/">Return to the directory</Link>
    </section>
  );
}

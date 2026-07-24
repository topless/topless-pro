import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBeach, submitCorrection } from '../lib/api';
import { confidenceLabels, dressCodeLabels, recognitionLabels } from '../lib/labels';
import type { Beach } from '../types';

export function BeachPage() {
  const { slug = '' } = useParams();
  const [beach, setBeach] = useState<Beach | null>();
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBeach(undefined);

    getBeach(slug)
      .then((item) => {
        if (!cancelled) setBeach(item);
      })
      .catch(() => {
        if (!cancelled) setBeach(null);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true);
    setStatus('Sending…');

    try {
      await submitCorrection({
        beachSlug: slug,
        email: String(form.get('email') ?? ''),
        message: String(form.get('message') ?? ''),
        website: String(form.get('website') ?? ''),
      });
      formElement.reset();
      setStatus('Thanks — your report is ready for review.');
    } catch {
      setStatus('The report could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (beach === undefined) return <section className="content-page"><p>Loading beach…</p></section>;
  if (beach === null) return <section className="content-page"><h1>Beach not found</h1><Link to="/">Return to the directory</Link></section>;

  return (
    <section className="content-page beach-detail">
      <Link className="back-link" to="/">← All beaches</Link>
      <p className="eyebrow">{beach.municipality ?? beach.region}, {beach.countryName}</p>
      <h1>{beach.name}</h1>
      <div className="badges large">
        <span className={`badge badge-${beach.dressCode}`}>{dressCodeLabels[beach.dressCode]}</span>
        <span className="badge badge-neutral">{recognitionLabels[beach.recognition]}</span>
      </div>
      <p className="lead">{beach.summary}</p>

      <dl className="facts">
        <div><dt>Confidence</dt><dd>{confidenceLabels[beach.confidence]}</dd></div>
        <div><dt>Last verified</dt><dd>{beach.lastVerifiedAt ?? 'Not recorded'}</dd></div>
        <div><dt>Coordinates</dt><dd>{beach.latitude}, {beach.longitude}</dd></div>
        <div><dt>Facilities</dt><dd>{beach.facilities.length ? beach.facilities.join(', ') : 'Not recorded'}</dd></div>
      </dl>

      {beach.sourceUrl && <a className="source-link" href={beach.sourceUrl} target="_blank" rel="noreferrer">View supporting source ↗</a>}

      <div className="correction-panel">
        <h2>Something changed?</h2>
        <p>Send a correction. Reports are reviewed before publication.</p>
        <form onSubmit={onSubmit}>
          <label className="honeypot" aria-hidden="true">
            Leave this field blank
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label>Email (optional)<input type="email" name="email" /></label>
          <label>What should we update?<textarea name="message" required minLength={10} rows={5} /></label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit correction'}
          </button>
          {status && <p role="status">{status}</p>}
        </form>
      </div>
    </section>
  );
}

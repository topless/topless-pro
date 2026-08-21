import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, getBeach, submitCorrection } from '../lib/api';
import { useDocumentTitle } from '../lib/document-title';
import { confidenceLabels, dressCodeLabels, formatBeachLocation, formatBeachTitle, formatDate, recognitionLabels } from '../lib/labels';
import type { Beach } from '../types';

function mapsUrl(beach: Pick<Beach, 'latitude' | 'longitude'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${beach.latitude},${beach.longitude}`;
}

export function BeachPage() {
  const { slug = '' } = useParams();
  const [beach, setBeach] = useState<Beach | null>();
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useDocumentTitle(
    beach === undefined ? null : beach === null ? 'Beach not found — topless.pro' : formatBeachTitle(beach),
  );

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
    if (submitting) return;
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
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setStatus('You’ve sent several reports in a short time. Please wait a minute and try again.');
      } else if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        setStatus(error.message);
      } else {
        setStatus('The report could not be sent. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (beach === undefined) return <section className="content-page"><p>Loading beach…</p></section>;
  if (beach === null) {
    return (
      <section className="content-page">
        <h1>Beach not found</h1>
        <Link className="back-link" to="/">Return to the directory</Link>
      </section>
    );
  }

  return (
    <section className="content-page beach-detail">
      <Link className="back-link" to="/"><span aria-hidden="true">← </span>All beaches</Link>
      <p className="eyebrow">{formatBeachLocation(beach)}</p>
      <h1>{beach.name}</h1>
      <div className="badges large">
        <span className={`badge badge-${beach.dressCode}`}>{dressCodeLabels[beach.dressCode]}</span>
        <span className={`badge badge-recognition-${beach.recognition}`}>{recognitionLabels[beach.recognition]}</span>
      </div>
      <p className="lead">{beach.summary}</p>

      <dl className="facts">
        <div><dt>Confidence</dt><dd>{confidenceLabels[beach.confidence]}</dd></div>
        <div>
          <dt>Last verified</dt>
          <dd>{beach.lastVerifiedAt ? <time dateTime={beach.lastVerifiedAt}>{formatDate(beach.lastVerifiedAt)}</time> : 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            <a href={mapsUrl(beach)} rel="noreferrer">Open in maps<span aria-hidden="true"> ↗</span></a>
            <small>{beach.latitude}, {beach.longitude}</small>
          </dd>
        </div>
        {beach.facilities.length > 0 && (
          <div><dt>Facilities</dt><dd>{beach.facilities.join(', ')}</dd></div>
        )}
      </dl>

      {beach.sourceUrl && (
        <a className="source-link" href={beach.sourceUrl} rel="noreferrer">View supporting source<span aria-hidden="true"> ↗</span></a>
      )}

      <div className="correction-panel">
        <h2>Something changed?</h2>
        <p>Send a correction. Reports are reviewed before publication.</p>
        <form onSubmit={onSubmit}>
          <label className="honeypot" aria-hidden="true">
            Leave this field blank
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label>Email (optional)<input type="email" name="email" autoComplete="email" /></label>
          <label>What should we update?<textarea name="message" required minLength={10} maxLength={4000} rows={5} /></label>
          <button type="submit">
            {submitting ? 'Sending…' : 'Submit correction'}
          </button>
          <p className="form-status" role="status" aria-live="polite">{status}</p>
        </form>
      </div>
    </section>
  );
}

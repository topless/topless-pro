import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dataFilePath } from '../../shared/place.mjs';
import { ApiError, getBeach, submitCorrection } from '../lib/api';
import { useDocumentTitle } from '../lib/document-title';
import { mapLinks } from '../lib/map-links';
import { useRestoreScroll } from '../lib/scroll-memory';
import {
  confidenceDescriptions,
  confidenceLabels,
  dressCodeDescriptions,
  dressCodeLabels,
  formatBeachLocation,
  formatBeachTitle,
  formatDate,
  REPO_URL,
  recognitionDescriptions,
  recognitionLabels,
  sourceHostname,
} from '../lib/labels';
import type { Beach } from '../types';

export function BeachPage() {
  const { slug = '' } = useParams();
  const [beach, setBeach] = useState<Beach | null>();
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useDocumentTitle(
    beach === undefined ? null : beach === null ? 'No listing here — topless.pro' : formatBeachTitle(beach),
  );
  useRestoreScroll(beach !== undefined);

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
      setStatus('Thanks. We’ve got your report and will check it before changing anything.');
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

  if (beach === undefined) {
    return (
      <section className="content-page">
        <p className="eyebrow">Loading</p>
        <h1>Loading beach…</h1>
      </section>
    );
  }
  if (beach === null) {
    return (
      <section className="content-page prose">
        <p className="eyebrow">Not found</p>
        <h1>No listing here.</h1>
        <p>It may have been removed, or it hasn’t been published yet.</p>
        <Link className="back-link" to="/"><span aria-hidden="true">← </span>All beaches</Link>
      </section>
    );
  }

  return (
    <section className="content-page beach-detail">
      <Link className="back-link" to="/"><span aria-hidden="true">← </span>All beaches</Link>
      <p className="eyebrow">{formatBeachLocation(beach)}</p>
      <h1>{beach.name}</h1>

      <div className="answer">
        <span className={`chip chip-lg chip-${beach.dressCode}`}>{dressCodeLabels[beach.dressCode]}</span>
        <p className="provenance">
          <span className={`recog recog-${beach.recognition}`}>{recognitionLabels[beach.recognition]}</span>
          <span>{confidenceLabels[beach.confidence]}</span>
          {beach.lastVerifiedAt && (
            <span>checked <time dateTime={beach.lastVerifiedAt}>{formatDate(beach.lastVerifiedAt)}</time></span>
          )}
          {beach.sourceUrl && (
            <a href={beach.sourceUrl} rel="noreferrer">{sourceHostname(beach.sourceUrl)}<span aria-hidden="true"> ↗</span></a>
          )}
        </p>
        <div className="means">
          <h2>What this means</h2>
          <ul>
            <li><strong>{dressCodeLabels[beach.dressCode]}</strong> — {dressCodeDescriptions[beach.dressCode]}</li>
            <li><strong>{recognitionLabels[beach.recognition]}</strong> — {recognitionDescriptions[beach.recognition]}</li>
            <li><strong>{confidenceLabels[beach.confidence]}</strong> — {confidenceDescriptions[beach.confidence]}</li>
          </ul>
        </div>
        <p className="answer-note">Not legal advice. Check current signage before you rely on this.</p>
      </div>

      {beach.summary && <p className="lead">{beach.summary}</p>}

      <dl className="facts">
        <div>
          <dt>Location</dt>
          <dd>
            <ul className="location-links">
              {mapLinks(beach).map((link) => (
                <li key={link.label}><a href={link.href} rel="noreferrer">{link.label}<span aria-hidden="true"> ↗</span></a></li>
              ))}
            </ul>
            <small>{beach.latitude}, {beach.longitude} · opens in another app or site</small>
          </dd>
        </div>
        {beach.facilities.length > 0 && (
          <div><dt>Facilities</dt><dd>{beach.facilities.join(', ')}</dd></div>
        )}
        {beach.region && beach.municipality && (
          <div>
            <dt>Listing history</dt>
            <dd>
              <a href={`${REPO_URL}/commits/main/${dataFilePath({ countryCode: beach.countryCode, region: beach.region, municipality: beach.municipality })}`} rel="noreferrer">Every change, on GitHub<span aria-hidden="true"> ↗</span></a>
              <small>Who changed what, and when.</small>
            </dd>
          </div>
        )}
      </dl>

      <div className="correction-panel">
        <h2>Is this wrong or out of date?</h2>
        <p>Tell us what you saw and when. A link to signage or an official page helps most. We check every report before changing a listing.</p>
        <details>
          <summary>Report a change</summary>
          <form onSubmit={onSubmit}>
            <label className="honeypot" aria-hidden="true">
              Leave this field blank
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label>
              Email (optional) <small>— only if you’d like a reply</small>
              <input type="email" name="email" autoComplete="email" />
            </label>
            <label>
              What did you see, and when?
              <textarea name="message" required minLength={10} maxLength={4000} rows={5} />
            </label>
            <button type="submit">
              {submitting ? 'Sending…' : 'Submit correction'}
            </button>
            <p className="form-note">We keep your message, and your email if you give one, only to review this report and reply. Your IP address is used to limit repeat submissions and isn’t stored with your report.</p>
          </form>
        </details>
        <p className="form-status" role="status" aria-live="polite">{status}</p>
      </div>
    </section>
  );
}

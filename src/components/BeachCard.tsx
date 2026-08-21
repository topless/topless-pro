import { Link } from 'react-router-dom';
import { confidenceLabels, dressCodeLabels, formatBeachLocation, formatMonthYear, recognitionLabels } from '../lib/labels';
import type { Beach } from '../types';

export function BeachCard({ beach }: { beach: Beach }) {
  return (
    <article className="beach-row">
      <div className="beach-row-verdict">
        <span className={`chip chip-${beach.dressCode}`}>{dressCodeLabels[beach.dressCode]}</span>
      </div>
      <div className="beach-row-body">
        <p className="eyebrow">{formatBeachLocation(beach)}</p>
        <h2><Link to={`/beaches/${beach.slug}`}>{beach.name}</Link></h2>
        <p className="beach-row-meta">
          <span className={`recog recog-${beach.recognition}`}>{recognitionLabels[beach.recognition]}</span>
          <span>{confidenceLabels[beach.confidence]}</span>
          {beach.lastVerifiedAt && <span>checked {formatMonthYear(beach.lastVerifiedAt)}</span>}
        </p>
        {beach.summary && <p className="beach-row-summary">{beach.summary}</p>}
      </div>
    </article>
  );
}

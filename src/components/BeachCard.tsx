import { Link } from 'react-router-dom';
import { confidenceLabels, dressCodeLabels, formatBeachLocation, recognitionLabels } from '../lib/labels';
import type { Beach } from '../types';

export function BeachCard({ beach }: { beach: Beach }) {
  return (
    <article className="beach-card">
      <div>
        <p className="eyebrow">{formatBeachLocation(beach)}</p>
        <h2><Link to={`/beaches/${beach.slug}`}>{beach.name}</Link></h2>
      </div>
      <div className="badges">
        <span className={`badge badge-${beach.dressCode}`}>{dressCodeLabels[beach.dressCode]}</span>
        <span className={`badge badge-recognition-${beach.recognition}`}>{recognitionLabels[beach.recognition]}</span>
      </div>
      <p>{beach.summary}</p>
      <span className="confidence">{confidenceLabels[beach.confidence]}</span>
    </article>
  );
}

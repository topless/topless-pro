import { Link } from 'react-router-dom';
import { confidenceLabels, dressCodeLabels, formatBeachLocation, recognitionLabels } from '../lib/labels';
import type { Beach } from '../types';

export function BeachCard({ beach }: { beach: Beach }) {
  return (
    <Link className="beach-card" to={`/beaches/${beach.slug}`}>
      <div>
        <p className="eyebrow">{formatBeachLocation(beach)}</p>
        <h2>{beach.name}</h2>
      </div>
      <div className="badges">
        <span className={`badge badge-${beach.dressCode}`}>{dressCodeLabels[beach.dressCode]}</span>
        <span className={`badge badge-recognition-${beach.recognition}`}>{recognitionLabels[beach.recognition]}</span>
      </div>
      <p>{beach.summary}</p>
      <span className="confidence">{confidenceLabels[beach.confidence]}</span>
    </Link>
  );
}

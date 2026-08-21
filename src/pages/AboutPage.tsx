import { useDocumentTitle } from '../lib/document-title';
import {
  CONFIDENCES,
  DRESS_CODES,
  RECOGNITIONS,
  confidenceDescriptions,
  confidenceLabels,
  dressCodeDescriptions,
  dressCodeLabels,
  recognitionDescriptions,
  recognitionLabels,
} from '../lib/labels';

export function AboutPage() {
  useDocumentTitle('About — topless.pro');

  return (
    <section className="content-page prose">
      <p className="eyebrow">About topless.pro</p>
      <h1>Practical guidance, not assumptions.</h1>
      <p>Beach rules are often a mixture of law, official designation and local custom. We keep those concepts separate so visitors can make informed and respectful choices.</p>

      <h2>What the labels mean</h2>
      <h3>What to wear</h3>
      <dl className="definitions">
        {DRESS_CODES.map((code) => (
          <div key={code}>
            <dt><span className={`chip chip-${code}`}>{dressCodeLabels[code]}</span></dt>
            <dd>{dressCodeDescriptions[code]}</dd>
          </div>
        ))}
      </dl>
      <h3>How sure we are</h3>
      <dl className="definitions">
        {RECOGNITIONS.map((level) => (
          <div key={level}>
            <dt><span className={`recog recog-${level}`}>{recognitionLabels[level]}</span></dt>
            <dd>{recognitionDescriptions[level]}</dd>
          </div>
        ))}
      </dl>
      <h3>Confidence</h3>
      <dl className="definitions">
        {CONFIDENCES.map((level) => (
          <div key={level}>
            <dt>{confidenceLabels[level]}</dt>
            <dd>{confidenceDescriptions[level]}</dd>
          </div>
        ))}
      </dl>
      <p>Confidence describes how sure we are about the clothing guidance, not about the beach’s location.</p>

      <h2>Important</h2>
      <p>This directory is informational, not legal advice. Conditions, rules and enforcement can change. Follow current signage and instructions from local authorities.</p>
    </section>
  );
}

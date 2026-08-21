import { useDocumentTitle } from '../lib/document-title';
import {
  ABOUT_TITLE,
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

const REPO_URL = 'https://github.com/topless/topless-pro';

export function AboutPage() {
  useDocumentTitle(ABOUT_TITLE);

  return (
    <section className="content-page prose">
      <p className="eyebrow">About topless.pro</p>
      <h1>Rules, custom and hearsay — kept apart.</h1>
      <p>Beach rules are a mixture of law, official designation and local custom. We keep those apart, say how sure we are, and show the source — so you can decide for yourself.</p>

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

      <h2>How we verify</h2>
      <p>Every published listing has a source that supports the clothing guidance itself, not just the beach’s existence, plus a short summary and the date we last checked it. A map pin is not evidence. High confidence always has a supporting source; local knowledge without a citable source is at most medium.</p>

      <h2>Your reports and privacy</h2>
      <p>This site sets no cookies and runs no analytics. When you send a correction we store what you typed, and your email address if you give one, only to review the report and reply. Your IP address is used to limit repeat submissions and isn’t stored with your report. To have a report deleted, send a correction from the same beach page saying so and we’ll remove it.</p>

      <h2>Important</h2>
      <p>This is general information, not legal advice, and it can go out of date. Public nudity — and in some places toplessness — can be an offence even where it’s customary, and anything that isn’t an official rule can be enforced against at any time. Check current signage, and when in doubt, follow what the people around you are doing.</p>

      <h2>Who runs this</h2>
      <p>topless.pro is researched and edited independently from Switzerland by one editor. It isn’t affiliated with any authority, beach operator or naturist organisation, and it carries no advertising. The code and the data are public on <a href={REPO_URL} rel="noreferrer">GitHub<span aria-hidden="true"> ↗</span></a>.</p>
    </section>
  );
}

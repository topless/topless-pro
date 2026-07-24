import type { Beach } from '../types';

export async function getBeaches(): Promise<Beach[]> {
  const response = await fetch('/api/beaches');
  if (!response.ok) throw new Error('Unable to load beaches');
  return response.json();
}

export async function getBeach(slug: string): Promise<Beach | null> {
  const response = await fetch(`/api/beaches/${encodeURIComponent(slug)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Unable to load beach');
  return response.json();
}

export async function submitCorrection(payload: {
  beachSlug: string;
  email?: string;
  message: string;
  website?: string;
}): Promise<void> {
  const response = await fetch('/api/corrections', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Unable to submit correction');
}

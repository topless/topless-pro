import type { Beach } from '../types';

async function fetchBeaches(): Promise<Beach[]> {
  const response = await fetch('/api/beaches');
  if (!response.ok) throw new Error('Unable to load beaches');
  return response.json();
}

// The directory is fetched once per page load and reused on Back navigation; a failure is
// never cached, and "Try again" asks for a fresh copy.
let directory: Promise<Beach[]> | null = null;

export function getBeaches({ fresh = false } = {}): Promise<Beach[]> {
  if (fresh || directory === null) {
    directory = fetchBeaches().catch((error: unknown) => {
      directory = null;
      throw error;
    });
  }
  return directory;
}

export async function getBeach(slug: string): Promise<Beach | null> {
  const response = await fetch(`/api/beaches/${encodeURIComponent(slug)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Unable to load beach');
  return response.json();
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
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
  if (response.ok) return;

  let message = 'Unable to submit correction';
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
      message = body.error;
    }
  } catch {
    // Non-JSON error body; keep the generic message.
  }
  throw new ApiError(response.status, message);
}

import { describe, expect, it } from 'vitest';
import { dressCodeLabels } from './labels';

describe('dressCodeLabels', () => {
  it('keeps public labels explicit', () => {
    expect(dressCodeLabels['swimwear-required']).toBe('Swimwear required');
    expect(dressCodeLabels['topless-permitted']).toBe('Topless permitted');
    expect(dressCodeLabels['nudity-permitted']).toBe('Nudity permitted');
    expect(dressCodeLabels.unknown).toBe('Unknown');
  });
});

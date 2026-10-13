import { describe, expect, it } from 'vitest';
import { normalCdf, probabilityWithin } from './stats';

describe('stats', () => {
  it('normalCdf sesuai nilai baku', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4);
    expect(normalCdf(1.645)).toBeCloseTo(0.95, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it('probabilityWithin menangani sd = 0', () => {
    expect(probabilityWithin(10, 8, 0)).toBe(1);
    expect(probabilityWithin(5, 8, 0)).toBe(0);
  });

  it('probabilityWithin mendekati 50% pada nilai harapan', () => {
    expect(probabilityWithin(20, 20, 3)).toBeCloseTo(0.5, 4);
  });
});

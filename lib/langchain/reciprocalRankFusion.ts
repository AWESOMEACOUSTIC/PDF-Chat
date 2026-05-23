export interface RrfInputMatch {
  id: string;
  metadata?: Record<string, unknown>;
}

export interface RrfResult {
  id: string;
  metadata?: Record<string, unknown>;
  rrfScore: number;
}

interface RrfOptions {
  rrfConstant?: number;
  keySelector?: (match: RrfInputMatch) => string;
}

export function reciprocalRankFusion(
  denseMatches: RrfInputMatch[],
  sparseMatches: RrfInputMatch[],
  finalTopK: number,
  options: RrfOptions = {}
): RrfResult[] {
  const rrfConstant = options.rrfConstant ?? 60;
  const keySelector = options.keySelector ?? ((match: RrfInputMatch) => match.id);
  const fusedScores = new Map<string, { score: number; metadata?: Record<string, unknown> }>();

  const processList = (matches: RrfInputMatch[]) => {
    matches.forEach((match, index) => {
      const rank = index + 1;
      const rrfScore = 1 / (rrfConstant + rank);
      const key = keySelector(match);
      const existing = fusedScores.get(key);

      if (existing) {
        existing.score += rrfScore;
        if (!existing.metadata && match.metadata) {
          existing.metadata = match.metadata;
        }
      } else {
        fusedScores.set(key, { score: rrfScore, metadata: match.metadata });
      }
    });
  };

  processList(denseMatches);
  processList(sparseMatches);

  return Array.from(fusedScores.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, Math.max(finalTopK, 0))
    .map(([id, data]) => ({
      id,
      metadata: data.metadata,
      rrfScore: data.score,
    }));
}
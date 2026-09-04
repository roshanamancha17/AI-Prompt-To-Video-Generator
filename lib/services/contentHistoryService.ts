import { prisma } from '@/lib/db/prisma';

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3), // drop short stopword-ish tokens
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.35;

/**
 * Flags topics that overlap heavily with the user's recent content, per the
 * spec's "avoid repeating recent topics" requirement. This is a lightweight
 * lexical check (Jaccard similarity over word sets), not semantic search —
 * good enough to catch near-duplicate phrasing, not paraphrases.
 */
export async function findSimilarRecentTopics(userId: string, topic: string, limit = 30) {
  const recent = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, topic: true, createdAt: true },
  });

  const target = tokenize(topic);

  return recent
    .map((p) => ({ ...p, similarity: jaccardSimilarity(target, tokenize(p.topic)) }))
    .filter((p) => p.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity);
}

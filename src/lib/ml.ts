import { dbRun, dbAll } from './db';

export async function storeInsight(sequenceId: number, type: string, data: Record<string, unknown>, confidence: number) {
  await dbRun(`
    INSERT INTO ml_insights (sequence_id, insight_type, insight_data, confidence)
    VALUES (?, ?, ?, ?)
  `, [sequenceId, type, JSON.stringify(data), confidence]);
}

export async function getInsightsForSequence(sequenceId: number): Promise<string> {
  const insights = await dbAll(`
    SELECT insight_type, insight_data, confidence
    FROM ml_insights
    WHERE sequence_id = ?
    ORDER BY confidence DESC
    LIMIT 20
  `, [sequenceId]) as unknown as { insight_type: string; insight_data: string; confidence: number }[];

  if (insights.length === 0) return '';

  return insights.map(i => {
    const data = JSON.parse(i.insight_data as string);
    return `[${i.insight_type}] (confidence: ${(Number(i.confidence) * 100).toFixed(0)}%): ${JSON.stringify(data)}`;
  }).join('\n');
}

export async function getAllInsights(): Promise<{ type: string; data: Record<string, unknown>; confidence: number; sequenceId: number }[]> {
  const rows = await dbAll(`
    SELECT sequence_id, insight_type, insight_data, confidence
    FROM ml_insights
    ORDER BY created_at DESC
    LIMIT 50
  `) as unknown as { sequence_id: number; insight_type: string; insight_data: string; confidence: number }[];

  return rows.map(r => ({
    type: r.insight_type as string,
    data: JSON.parse(r.insight_data as string),
    confidence: Number(r.confidence),
    sequenceId: Number(r.sequence_id),
  }));
}

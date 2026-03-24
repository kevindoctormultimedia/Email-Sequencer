import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun } from '@/lib/db';
import { generateABVariants } from '@/lib/ai';
import { getInsightsForSequence } from '@/lib/ml';

export async function POST(req: NextRequest) {
  const { sequence_step_id } = await req.json();

  const step = await dbGet(`
    SELECT ss.*, s.name as sequence_name, s.id as seq_id
    FROM sequence_steps ss
    JOIN sequences s ON ss.sequence_id = s.id
    WHERE ss.id = ?
  `, [sequence_step_id]) as unknown as {
    id: number; subject: string; body_html: string; sequence_name: string; seq_id: number;
  } | null;

  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 });

  const insights = await getInsightsForSequence(Number(step.seq_id));
  const variants = await generateABVariants(step.subject as string, step.body_html as string, step.sequence_name as string, insights);

  // Save variants as A/B tests
  const created = [];

  for (let i = 0; i < variants.length; i++) {
    const variantName = String.fromCharCode(65 + i); // A, B, C...
    const result = await dbRun('INSERT INTO ab_tests (sequence_step_id, variant_name, subject, body_html) VALUES (?, ?, ?, ?)', [
      sequence_step_id, variantName, variants[i].subject, variants[i].body_html
    ]);
    created.push({ id: result.lastInsertRowid, variant_name: variantName, ...variants[i] });
  }

  return NextResponse.json({ variants: created });
}

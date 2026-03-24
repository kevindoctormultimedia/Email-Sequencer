import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbAll, dbRun } from '@/lib/db';
import { analyzeABTestResults } from '@/lib/ai';
import { storeInsight } from '@/lib/ml';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { use_ai } = await req.json();

  const test = await dbGet('SELECT * FROM ab_tests WHERE id = ?', [id]) as unknown as {
    id: number; sequence_step_id: number; variant_name: string;
  } | null;

  if (!test) return NextResponse.json({ error: 'Test not found' }, { status: 404 });

  if (use_ai) {
    // Get all variants for this step
    const variants = await dbAll(`
      SELECT ab.variant_name as name,
        (SELECT COUNT(*) FROM sent_emails WHERE ab_variant_name = ab.variant_name AND sequence_step_id = ab.sequence_step_id) as sends,
        (SELECT COUNT(*) FROM sent_emails WHERE ab_variant_name = ab.variant_name AND sequence_step_id = ab.sequence_step_id AND opened_at IS NOT NULL) as opens,
        (SELECT COUNT(*) FROM sent_emails WHERE ab_variant_name = ab.variant_name AND sequence_step_id = ab.sequence_step_id AND replied_at IS NOT NULL) as replies
      FROM ab_tests ab
      WHERE ab.sequence_step_id = ?
    `, [test.sequence_step_id]) as unknown as { name: string; sends: number; opens: number; replies: number }[];

    const result = await analyzeABTestResults(variants.map(v => ({
      name: v.name as string,
      sends: Number(v.sends),
      opens: Number(v.opens),
      replies: Number(v.replies),
    })));

    // Update statuses
    await dbRun("UPDATE ab_tests SET status = 'loser' WHERE sequence_step_id = ?", [test.sequence_step_id]);
    if (result.winner) {
      await dbRun("UPDATE ab_tests SET status = 'winner' WHERE sequence_step_id = ? AND variant_name = ?", [test.sequence_step_id, result.winner]);
    }

    // Store insights
    const step = await dbGet('SELECT sequence_id FROM sequence_steps WHERE id = ?', [test.sequence_step_id]) as unknown as { sequence_id: number };
    for (const insight of result.insights) {
      await storeInsight(Number(step.sequence_id), 'ab_test_result', { insight, reasoning: result.reasoning }, 0.8);
    }

    return NextResponse.json({ winner: result.winner, reasoning: result.reasoning, insights: result.insights });
  } else {
    // Manual pick -- this variant is the winner
    await dbRun("UPDATE ab_tests SET status = 'loser' WHERE sequence_step_id = ?", [test.sequence_step_id]);
    await dbRun("UPDATE ab_tests SET status = 'winner' WHERE id = ?", [id]);
    return NextResponse.json({ winner: test.variant_name });
  }
}

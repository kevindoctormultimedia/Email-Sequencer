import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbRun } from '@/lib/db';

export async function GET() {
  const tests = await dbAll(`
    SELECT ab.*, ss.subject as step_subject, s.name as sequence_name,
      (SELECT COUNT(*) FROM sent_emails WHERE ab_variant_name = ab.variant_name AND sequence_step_id = ab.sequence_step_id) as sends,
      (SELECT COUNT(*) FROM sent_emails WHERE ab_variant_name = ab.variant_name AND sequence_step_id = ab.sequence_step_id AND opened_at IS NOT NULL) as opens,
      (SELECT COUNT(*) FROM sent_emails WHERE ab_variant_name = ab.variant_name AND sequence_step_id = ab.sequence_step_id AND replied_at IS NOT NULL) as replies
    FROM ab_tests ab
    JOIN sequence_steps ss ON ab.sequence_step_id = ss.id
    JOIN sequences s ON ss.sequence_id = s.id
    ORDER BY ab.created_at DESC
  `);
  return NextResponse.json(tests);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const result = await dbRun(`
    INSERT INTO ab_tests (sequence_step_id, variant_name, subject, body_html)
    VALUES (?, ?, ?, ?)
  `, [body.sequence_step_id, body.variant_name, body.subject, body.body_html]);

  return NextResponse.json({ id: result.lastInsertRowid });
}

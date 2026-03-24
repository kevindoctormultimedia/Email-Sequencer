import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbAll, dbRun } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sequence = await dbGet('SELECT * FROM sequences WHERE id = ?', [id]);
  if (!sequence) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const steps = await dbAll('SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order', [id]);
  const contacts = await dbAll('SELECT id, email, current_step, status FROM contacts WHERE sequence_id = ?', [id]);

  // Per-step analytics
  const analytics = await dbAll(`
    SELECT ss.step_order,
      COUNT(se.id) as sent,
      SUM(CASE WHEN se.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN se.replied_at IS NOT NULL THEN 1 ELSE 0 END) as replied
    FROM sequence_steps ss
    LEFT JOIN sent_emails se ON se.sequence_step_id = ss.id
    WHERE ss.sequence_id = ?
    GROUP BY ss.step_order
    ORDER BY ss.step_order
  `, [id]);

  return NextResponse.json({ ...sequence, steps, contacts, analytics });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbRun('DELETE FROM sequences WHERE id = ?', [id]);
  return NextResponse.json({ success: true });
}

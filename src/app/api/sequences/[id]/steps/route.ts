import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbGet, dbRun } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const steps = await dbAll('SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order', [id]);
  return NextResponse.json(steps);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Get next step order
  const maxStep = await dbGet('SELECT MAX(step_order) as max_order FROM sequence_steps WHERE sequence_id = ?', [id]) as unknown as { max_order: number | null } | null;
  const nextOrder = (maxStep?.max_order || 0) + 1;

  const result = await dbRun(`
    INSERT INTO sequence_steps (sequence_id, step_order, subject, body_html, delay_days)
    VALUES (?, ?, ?, ?, ?)
  `, [id, nextOrder, body.subject, body.body_html, body.delay_days || 1]);

  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();

  await dbRun('UPDATE sequence_steps SET subject = ?, body_html = ?, delay_days = ? WHERE id = ?', [
    body.subject, body.body_html, body.delay_days, body.id
  ]);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  await dbRun('DELETE FROM sequence_steps WHERE id = ?', [body.id]);
  return NextResponse.json({ success: true });
}

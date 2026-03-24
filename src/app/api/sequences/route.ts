import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbRun } from '@/lib/db';

export async function GET() {
  const sequences = await dbAll(`
    SELECT s.*,
      (SELECT COUNT(*) FROM contacts WHERE sequence_id = s.id) as contact_count,
      (SELECT COUNT(*) FROM sequence_steps WHERE sequence_id = s.id) as step_count
    FROM sequences s
    ORDER BY s.created_at DESC
  `);
  return NextResponse.json(sequences);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const result = await dbRun('INSERT INTO sequences (name, website_maker_pattern, description) VALUES (?, ?, ?)', [
    body.name,
    body.website_maker_pattern || '',
    body.description || ''
  ]);

  return NextResponse.json({ id: result.lastInsertRowid });
}

import { NextRequest, NextResponse } from 'next/server';
import { dbRun } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sequence_id } = await req.json();

  await dbRun('UPDATE contacts SET sequence_id = ?, status = ? WHERE id = ?', [sequence_id, 'active', id]);

  return NextResponse.json({ success: true });
}

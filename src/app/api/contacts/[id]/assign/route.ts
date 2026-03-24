import { NextRequest, NextResponse } from 'next/server';
import { dbRun } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  await dbRun('UPDATE contacts SET sequence_id = ?, status = ? WHERE id = ?', [
    body.sequence_id || null,
    body.sequence_id ? 'active' : 'active',
    id
  ]);

  return NextResponse.json({ success: true });
}

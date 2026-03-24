import { NextRequest, NextResponse } from 'next/server';
import { dbRun } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { contact_ids, sequence_id } = await req.json();

  for (const id of contact_ids) {
    await dbRun('UPDATE contacts SET sequence_id = ?, status = ? WHERE id = ?', [sequence_id, 'active', id]);
  }

  return NextResponse.json({ success: true, updated: contact_ids.length });
}

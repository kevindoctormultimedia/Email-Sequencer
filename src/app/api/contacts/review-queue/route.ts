import { NextResponse } from 'next/server';
import { dbAll } from '@/lib/db';

export async function GET() {
  const contacts = await dbAll(`
    SELECT c.*, s.name as sequence_name
    FROM contacts c
    LEFT JOIN sequences s ON c.sequence_id = s.id
    WHERE c.status = 'needs_review'
    ORDER BY c.created_at DESC
  `);
  return NextResponse.json(contacts);
}

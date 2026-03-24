import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbRun } from '@/lib/db';

export async function GET() {
  const contacts = await dbAll(`
    SELECT c.*, s.name as sequence_name
    FROM contacts c
    LEFT JOIN sequences s ON c.sequence_id = s.id
    ORDER BY c.created_at DESC
  `);
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const result = await dbRun(`
    INSERT INTO contacts (email, domain, first_name, last_name, company)
    VALUES (?, ?, ?, ?, ?)
  `, [
    body.email,
    body.email.split('@')[1] || '',
    body.first_name || '',
    body.last_name || '',
    body.company || ''
  ]);

  return NextResponse.json({ id: result.lastInsertRowid });
}

import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbRun } from '@/lib/db';

export async function GET() {
  const rows = await dbAll('SELECT key, value FROM settings') as unknown as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key as string] = row.value as string;
  }
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      await dbRun('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
    }
  }

  return NextResponse.json({ success: true });
}

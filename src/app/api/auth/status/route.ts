import { NextResponse } from 'next/server';
import { isOAuthConnected } from '@/lib/gmail-oauth';
import { dbGet } from '@/lib/db';

export async function GET() {
  const connected = await isOAuthConnected();
  const row = await dbGet("SELECT value FROM settings WHERE key = 'gmail_oauth_email'") as unknown as { value: string } | null;

  return NextResponse.json({
    connected,
    email: row?.value || '',
  });
}

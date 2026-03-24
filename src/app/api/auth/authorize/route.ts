import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail-oauth';

export async function GET() {
  const authUrl = getAuthUrl();

  if (!authUrl) {
    return NextResponse.json(
      { error: 'OAuth not configured. Please add your Client ID and Client Secret in Settings first.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ authUrl });
}

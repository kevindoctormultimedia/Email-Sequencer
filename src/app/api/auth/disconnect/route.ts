import { NextResponse } from 'next/server';
import { disconnectOAuth } from '@/lib/gmail-oauth';

export async function POST() {
  disconnectOAuth();
  return NextResponse.json({ success: true });
}

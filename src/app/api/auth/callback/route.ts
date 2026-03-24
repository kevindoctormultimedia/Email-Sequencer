import { NextRequest, NextResponse } from 'next/server';
import { handleCallback } from '@/lib/gmail-oauth';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    // User denied access or there was an error
    return NextResponse.redirect(new URL('/settings?oauth=error&message=' + encodeURIComponent(error), req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?oauth=error&message=No+authorization+code+received', req.url));
  }

  const result = await handleCallback(code);

  if (result.success) {
    return NextResponse.redirect(
      new URL(`/settings?oauth=success&email=${encodeURIComponent(result.email || '')}`, req.url)
    );
  } else {
    return NextResponse.redirect(
      new URL(`/settings?oauth=error&message=${encodeURIComponent(result.error || 'Unknown error')}`, req.url)
    );
  }
}

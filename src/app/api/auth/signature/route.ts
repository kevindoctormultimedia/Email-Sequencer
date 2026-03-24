import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getOAuth2Client, isOAuthConnected } from '@/lib/gmail-oauth';
import { dbRun } from '@/lib/db';

// GET: Fetch the user's Gmail signature
export async function GET() {
  if (!(await isOAuthConnected())) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });
  }

  try {
    const oauth2Client = await getOAuth2Client();
    if (!oauth2Client) {
      return NextResponse.json({ error: 'OAuth not configured' }, { status: 400 });
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get the user's send-as aliases to find the primary signature
    const res = await gmail.users.settings.sendAs.list({ userId: 'me' });
    const sendAsSettings = res.data.sendAs || [];

    // Find the primary send-as (or the default one)
    const primary = sendAsSettings.find(s => s.isPrimary) || sendAsSettings[0];

    if (!primary) {
      return NextResponse.json({ signature: '', message: 'No Gmail signature found' });
    }

    return NextResponse.json({
      signature: primary.signature || '',
      displayName: primary.displayName || '',
      sendAsEmail: primary.sendAsEmail || '',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch signature';
    console.error('Gmail signature fetch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Download a Google-hosted image and convert to base64 data URI
async function imageToDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

// Replace all Google-hosted signature images with base64 data URIs
async function inlineSignatureImages(html: string): Promise<string> {
  // Match all img src attributes with Google URLs
  const imgRegex = /src="(https:\/\/ci[0-9]*\.googleusercontent\.com\/[^"]+)"/g;
  const matches = [...html.matchAll(imgRegex)];

  let result = html;
  for (const match of matches) {
    const originalUrl = match[1];
    const dataUri = await imageToDataUri(originalUrl);
    if (dataUri) {
      result = result.replace(originalUrl, dataUri);
    }
  }

  // Also handle lh3.googleusercontent.com hosted images
  const lhRegex = /src="(https:\/\/lh[0-9]*\.googleusercontent\.com\/[^"]+)"/g;
  const lhMatches = [...result.matchAll(lhRegex)];
  for (const match of lhMatches) {
    const originalUrl = match[1];
    const dataUri = await imageToDataUri(originalUrl);
    if (dataUri) {
      result = result.replace(originalUrl, dataUri);
    }
  }

  return result;
}

// POST: Save the fetched Gmail signature to settings (with images inlined)
export async function POST() {
  if (!(await isOAuthConnected())) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });
  }

  try {
    const oauth2Client = await getOAuth2Client();
    if (!oauth2Client) {
      return NextResponse.json({ error: 'OAuth not configured' }, { status: 400 });
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const res = await gmail.users.settings.sendAs.list({ userId: 'me' });
    const sendAsSettings = res.data.sendAs || [];
    const primary = sendAsSettings.find(s => s.isPrimary) || sendAsSettings[0];

    if (!primary?.signature) {
      return NextResponse.json({ error: 'No Gmail signature found. Set one up in Gmail first.' }, { status: 404 });
    }

    // Inline all Google-hosted images as base64 so they work everywhere
    const signatureWithInlinedImages = await inlineSignatureImages(primary.signature);

    // Save to settings
    await dbRun("INSERT INTO settings (key, value) VALUES ('email_signature', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [signatureWithInlinedImages]);

    return NextResponse.json({
      success: true,
      signature: signatureWithInlinedImages,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync signature';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

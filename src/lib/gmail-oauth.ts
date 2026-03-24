import { google } from 'googleapis';
import { dbGet, dbRun } from './db';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/userinfo.email',
];

async function getSetting(key: string): Promise<string> {
  const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]) as unknown as { value: string } | null;
  return row?.value || '';
}

async function setSetting(key: string, value: string) {
  await dbRun('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export async function getOAuth2Client() {
  const clientId = await getSetting('google_client_id');
  const clientSecret = await getSetting('google_client_secret');
  const baseUrl = (await getSetting('app_base_url')) || 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${baseUrl}/api/auth/callback`
  );

  // Load stored tokens if available
  const accessToken = await getSetting('google_access_token');
  const refreshToken = await getSetting('google_refresh_token');
  const tokenExpiry = await getSetting('google_token_expiry');

  if (accessToken && refreshToken) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: tokenExpiry ? parseInt(tokenExpiry) : undefined,
    });

    // Set up automatic token refresh
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.access_token) {
        setSetting('google_access_token', tokens.access_token);
      }
      if (tokens.refresh_token) {
        setSetting('google_refresh_token', tokens.refresh_token);
      }
      if (tokens.expiry_date) {
        setSetting('google_token_expiry', tokens.expiry_date.toString());
      }
    });
  }

  return oauth2Client;
}

export async function getAuthUrl(): Promise<string | null> {
  const oauth2Client = await getOAuth2Client();
  if (!oauth2Client) return null;

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to always get refresh token
  });
}

export async function handleCallback(code: string): Promise<{ success: boolean; email?: string; error?: string }> {
  const oauth2Client = await getOAuth2Client();
  if (!oauth2Client) {
    return { success: false, error: 'OAuth not configured' };
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store tokens
    if (tokens.access_token) await setSetting('google_access_token', tokens.access_token);
    if (tokens.refresh_token) await setSetting('google_refresh_token', tokens.refresh_token);
    if (tokens.expiry_date) await setSetting('google_token_expiry', tokens.expiry_date.toString());

    // Get the user's email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email || '';

    if (email) {
      await setSetting('gmail_oauth_email', email);
      // Also set as the smtp_email for display purposes
      await setSetting('smtp_email', email);
    }

    return { success: true, email };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token exchange failed';
    return { success: false, error: message };
  }
}

export async function isOAuthConnected(): Promise<boolean> {
  const accessToken = await getSetting('google_access_token');
  const refreshToken = await getSetting('google_refresh_token');
  return !!(accessToken && refreshToken);
}

export async function disconnectOAuth() {
  const keys = ['google_access_token', 'google_refresh_token', 'google_token_expiry', 'gmail_oauth_email'];
  for (const key of keys) {
    await dbRun('DELETE FROM settings WHERE key = ?', [key]);
  }
}

export async function sendEmailViaGmailApi(
  to: string,
  subject: string,
  bodyHtml: string,
  fromName: string,
  fromEmail: string,
  headers?: Record<string, string>
): Promise<{ messageId: string }> {
  const oauth2Client = await getOAuth2Client();
  if (!oauth2Client) {
    throw new Error('Gmail OAuth not configured');
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Build the MIME message
  const boundary = '----=_Part_' + Date.now().toString(36);
  const mimeMessage = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ...Object.entries(headers || {}).map(([k, v]) => `${k}: ${v}`),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(bodyHtml).toString('base64'),
    `--${boundary}--`,
  ].join('\r\n');

  const encodedMessage = Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  return { messageId: res.data.id || '' };
}

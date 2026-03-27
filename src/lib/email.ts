import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun } from './db';
import { isOAuthConnected, sendEmailViaGmailApi } from './gmail-oauth';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from_name: string;
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const getSetting = async (key: string) => {
    const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]) as unknown as { value: string } | null;
    return row?.value || '';
  };

  return {
    host: 'smtp.gmail.com',
    port: 587,
    user: await getSetting('smtp_email'),
    pass: await getSetting('smtp_password'),
    from_name: (await getSetting('from_name')) || 'Email Sequencer',
  };
}

function createTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export async function getTrackingPixelUrl(trackingId: string): Promise<string> {
  const row = await dbGet("SELECT value FROM settings WHERE key = 'app_base_url'") as unknown as { value: string } | null;
  const baseUrl = row?.value || 'http://localhost:3000';
  return `${baseUrl}/api/track/open/${trackingId}`;
}

export async function injectTrackingPixel(html: string, trackingId: string): Promise<string> {
  const pixelUrl = await getTrackingPixelUrl(trackingId);
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }
  return html + pixel;
}

/**
 * Replace template variables in multiple formats:
 *  - {{first_name}}       -> Handlebars style
 *  - [First Name]         -> Bracket style (from imported docs)
 *  - {first_name}         -> Single brace style
 *  - Dr. [Last Name]      -> Common doc format
 */
export function replaceTemplateVars(template: string, vars: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    // {{key}} format
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');

    // {key} format (single braces)
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }

  // Map of bracket-style placeholders -> variable names
  const bracketMap: Record<string, string> = {
    'First Name': vars.first_name || '',
    'Last Name': vars.last_name || '',
    'Company': vars.company || '',
    'Domain': vars.domain || '',
    'Email': vars.email || '',
    'Your Name': vars.your_name || vars.sender_name || '',
    'first name': vars.first_name || '',
    'last name': vars.last_name || '',
    'company': vars.company || '',
    'domain': vars.domain || '',
    'email': vars.email || '',
  };

  for (const [placeholder, value] of Object.entries(bracketMap)) {
    // [Placeholder] format -- case insensitive
    result = result.replace(new RegExp(`\\[${placeholder}\\]`, 'gi'), value || '');
  }

  return result;
}

/**
 * Get the email signature HTML from settings
 */
async function getSignatureHtml(): Promise<string> {
  const row = await dbGet("SELECT value FROM settings WHERE key = 'email_signature'") as unknown as { value: string } | null;
  return row?.value || '';
}

/**
 * Inject the email signature at the end of the body
 */
async function injectSignature(bodyHtml: string): Promise<string> {
  const signature = await getSignatureHtml();
  if (!signature) return bodyHtml;

  const signatureBlock = `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">${signature}</div>`;

  if (bodyHtml.includes('</body>')) {
    return bodyHtml.replace('</body>', `${signatureBlock}</body>`);
  }
  return bodyHtml + signatureBlock;
}

// --- Spam Safeguards ---

interface RateLimits {
  max_per_minute: number;
  max_per_hour: number;
  max_per_day: number;
  delay_between_ms: number; // ms between each email
  ramp_up_enabled: boolean;
  ramp_up_day: number;      // current day in ramp-up (0 = not started)
}

export async function getRateLimits(): Promise<RateLimits> {
  const getSetting = async (key: string, defaultVal: string) => {
    const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]) as unknown as { value: string } | null;
    return row?.value || defaultVal;
  };

  return {
    max_per_minute: parseInt(await getSetting('rate_max_per_minute', '5')),
    max_per_hour: parseInt(await getSetting('rate_max_per_hour', '50')),
    max_per_day: parseInt(await getSetting('rate_max_per_day', '200')),
    delay_between_ms: parseInt(await getSetting('rate_delay_between_ms', '15000')), // 15s default
    ramp_up_enabled: (await getSetting('rate_ramp_up_enabled', 'true')) === 'true',
    ramp_up_day: parseInt(await getSetting('rate_ramp_up_day', '0')),
  };
}

// Ramp-up schedule: gradually increase daily limit over 2 weeks
const RAMP_UP_SCHEDULE: Record<number, number> = {
  1: 10,    // Day 1: 10 emails
  2: 15,    // Day 2: 15
  3: 25,    // Day 3: 25
  4: 35,    // Day 4: 35
  5: 50,    // Day 5: 50
  6: 65,    // Day 6: 65
  7: 80,    // Day 7: 80
  8: 100,   // Day 8: 100
  9: 120,   // Day 9: 120
  10: 140,  // Day 10: 140
  11: 160,  // Day 11: 160
  12: 180,  // Day 12: 180
  13: 200,  // Day 13: 200
  14: 200,  // Day 14+: full limit
};

export async function getDailyLimit(): Promise<number> {
  const limits = await getRateLimits();

  if (limits.ramp_up_enabled && limits.ramp_up_day > 0) {
    const day = Math.min(limits.ramp_up_day, 14);
    const rampLimit = RAMP_UP_SCHEDULE[day] || limits.max_per_day;
    return Math.min(rampLimit, limits.max_per_day);
  }

  return limits.max_per_day;
}

export async function getSentCountToday(): Promise<number> {
  const row = await dbGet(`
    SELECT COUNT(*) as count FROM sent_emails
    WHERE date(sent_at) = date('now')
  `) as unknown as { count: number };
  return Number(row.count);
}

export async function getSentCountLastHour(): Promise<number> {
  const row = await dbGet(`
    SELECT COUNT(*) as count FROM sent_emails
    WHERE sent_at >= datetime('now', '-1 hour')
  `) as unknown as { count: number };
  return Number(row.count);
}

export async function getSentCountLastMinute(): Promise<number> {
  const row = await dbGet(`
    SELECT COUNT(*) as count FROM sent_emails
    WHERE sent_at >= datetime('now', '-1 minute')
  `) as unknown as { count: number };
  return Number(row.count);
}

export async function canSendEmail(): Promise<{ allowed: boolean; reason?: string; waitMs?: number }> {
  const limits = await getRateLimits();
  const dailyLimit = await getDailyLimit();

  const sentToday = await getSentCountToday();
  if (sentToday >= dailyLimit) {
    const rampInfo = limits.ramp_up_enabled && limits.ramp_up_day > 0 && limits.ramp_up_day <= 14
      ? ` (ramp-up day ${limits.ramp_up_day}: ${dailyLimit} limit)`
      : '';
    return { allowed: false, reason: `Daily limit reached: ${sentToday}/${dailyLimit}${rampInfo}` };
  }

  const sentLastHour = await getSentCountLastHour();
  if (sentLastHour >= limits.max_per_hour) {
    return { allowed: false, reason: `Hourly limit reached: ${sentLastHour}/${limits.max_per_hour}`, waitMs: 60000 };
  }

  const sentLastMinute = await getSentCountLastMinute();
  if (sentLastMinute >= limits.max_per_minute) {
    return { allowed: false, reason: `Per-minute limit reached: ${sentLastMinute}/${limits.max_per_minute}`, waitMs: limits.delay_between_ms };
  }

  return { allowed: true };
}

/**
 * Advance the ramp-up day counter (call once per day)
 */
export async function advanceRampUp() {
  const limits = await getRateLimits();
  if (!limits.ramp_up_enabled) return;

  const newDay = limits.ramp_up_day + 1;
  await dbRun("INSERT INTO settings (key, value) VALUES ('rate_ramp_up_day', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [newDay.toString()]);
}

// --- Main Send Function ---

export async function sendEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  contactId: number,
  stepId: number | null,
  abVariant?: string
): Promise<{ success: boolean; trackingId: string; messageId: string; error?: string }> {
  // Check rate limits
  const rateCheck = await canSendEmail();
  if (!rateCheck.allowed) {
    return { success: false, trackingId: '', messageId: '', error: rateCheck.reason };
  }

  const config = await getEmailConfig();
  const trackingId = uuidv4();

  // Inject signature then tracking pixel
  const htmlWithSig = await injectSignature(bodyHtml);
  const htmlFinal = await injectTrackingPixel(htmlWithSig, trackingId);

  // Delay between emails for natural sending pattern
  const limits = await getRateLimits();
  if (limits.delay_between_ms > 0) {
    // Add some randomness to the delay (+/-30%) to look more human
    const jitter = limits.delay_between_ms * 0.3;
    const delay = limits.delay_between_ms + (Math.random() * jitter * 2 - jitter);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Try Gmail OAuth API first, then fall back to SMTP
  if (await isOAuthConnected()) {
    try {
      const oauthEmailRow = await dbGet("SELECT value FROM settings WHERE key = 'gmail_oauth_email'") as unknown as { value: string } | null;
      const oauthEmail = oauthEmailRow?.value || config.user;

      const result = await sendEmailViaGmailApi(
        to,
        subject,
        htmlFinal,
        config.from_name,
        oauthEmail,
        { 'X-Tracking-Id': trackingId }
      );

      await dbRun(`
        INSERT INTO sent_emails (contact_id, sequence_step_id, ab_variant_name, message_id, tracking_id, status)
        VALUES (?, ?, ?, ?, ?, 'sent')
      `, [contactId, stepId, abVariant || null, result.messageId, trackingId]);

      return { success: true, trackingId, messageId: result.messageId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gmail API error';
      console.error('Gmail API send failed, trying SMTP fallback:', message);
    }
  }

  // SMTP fallback
  if (!config.user || !config.pass) {
    return { success: false, trackingId: '', messageId: '', error: 'Email not configured. Connect Gmail OAuth or set up SMTP in Settings.' };
  }

  const transporter = createTransporter(config);

  try {
    const info = await transporter.sendMail({
      from: `"${config.from_name}" <${config.user}>`,
      to,
      subject,
      html: htmlFinal,
      headers: {
        'X-Tracking-Id': trackingId,
      },
    });

    await dbRun(`
      INSERT INTO sent_emails (contact_id, sequence_step_id, ab_variant_name, message_id, tracking_id, status)
      VALUES (?, ?, ?, ?, ?, 'sent')
    `, [contactId, stepId, abVariant || null, info.messageId, trackingId]);

    return { success: true, trackingId, messageId: info.messageId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, trackingId: '', messageId: '', error: message };
  }
}

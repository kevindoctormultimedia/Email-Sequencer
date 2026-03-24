import { dbGet, dbRun } from './db';

export async function recordOpen(trackingId: string, ip: string, userAgent: string) {
  const existing = await dbGet('SELECT * FROM sent_emails WHERE tracking_id = ?', [trackingId]) as unknown as {
    id: number; opened_at: string | null; open_count: number; open_ip: string | null; open_user_agent: string | null;
  } | null;

  if (!existing) return;

  const isFirstOpen = !existing.opened_at;
  const isDifferentSource = existing.open_ip && existing.open_ip !== ip;

  await dbRun(`
    UPDATE sent_emails
    SET opened_at = COALESCE(opened_at, datetime('now')),
        open_count = open_count + 1,
        open_ip = ?,
        open_user_agent = ?,
        status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END
    WHERE tracking_id = ?
  `, [ip, userAgent, trackingId]);

  // If loaded from a different IP than the first open, flag as potential forward
  if (!isFirstOpen && isDifferentSource) {
    await dbRun(`
      UPDATE sent_emails SET forwarded_at = COALESCE(forwarded_at, datetime('now')) WHERE tracking_id = ?
    `, [trackingId]);
  }
}

export async function recordReply(messageId: string) {
  await dbRun(`
    UPDATE sent_emails
    SET replied_at = COALESCE(replied_at, datetime('now')),
        status = 'replied'
    WHERE message_id = ?
  `, [messageId]);
}

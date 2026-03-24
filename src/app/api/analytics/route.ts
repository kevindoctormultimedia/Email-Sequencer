import { NextResponse } from 'next/server';
import { dbGet, dbAll } from '@/lib/db';

export async function GET() {
  const totalContactsRow = await dbGet('SELECT COUNT(*) as count FROM contacts') as unknown as { count: number };
  const totalContacts = Number(totalContactsRow.count);

  const activeSequencesRow = await dbGet('SELECT COUNT(*) as count FROM sequences') as unknown as { count: number };
  const activeSequences = Number(activeSequencesRow.count);

  const emailsSentTodayRow = await dbGet(`
    SELECT COUNT(*) as count FROM sent_emails WHERE date(sent_at) = date('now')
  `) as unknown as { count: number };
  const emailsSentToday = Number(emailsSentTodayRow.count);

  const totals = await dbGet(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) as replied,
      SUM(CASE WHEN forwarded_at IS NOT NULL THEN 1 ELSE 0 END) as forwarded
    FROM sent_emails
  `) as unknown as { total: number; opened: number; replied: number; forwarded: number };

  const total = Number(totals.total);
  const opened = Number(totals.opened);
  const replied = Number(totals.replied);
  const forwarded = Number(totals.forwarded);

  const avgOpenRate = total > 0 ? (opened / total) * 100 : 0;
  const avgReplyRate = total > 0 ? (replied / total) * 100 : 0;
  const avgForwardRate = total > 0 ? (forwarded / total) * 100 : 0;

  // Opens by day (last 14 days)
  const opensByDay = await dbAll(`
    SELECT
      date(sent_at) as date,
      COUNT(*) as sends,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opens
    FROM sent_emails
    WHERE sent_at >= datetime('now', '-14 days')
    GROUP BY date(sent_at)
    ORDER BY date(sent_at)
  `) as unknown as { date: string; sends: number; opens: number }[];

  // Recent activity
  const recentActivity = await dbAll(`
    SELECT se.id,
      CASE
        WHEN se.replied_at IS NOT NULL THEN 'replied'
        WHEN se.forwarded_at IS NOT NULL THEN 'forwarded'
        WHEN se.opened_at IS NOT NULL THEN 'opened'
        ELSE 'sent'
      END as type,
      c.email || ' - ' || COALESCE(ss.subject, 'email') as description,
      COALESCE(se.replied_at, se.forwarded_at, se.opened_at, se.sent_at) as time
    FROM sent_emails se
    JOIN contacts c ON se.contact_id = c.id
    LEFT JOIN sequence_steps ss ON se.sequence_step_id = ss.id
    ORDER BY COALESCE(se.replied_at, se.forwarded_at, se.opened_at, se.sent_at) DESC
    LIMIT 20
  `);

  return NextResponse.json({
    totalContacts,
    activeSequences,
    emailsSentToday,
    avgOpenRate,
    avgReplyRate,
    avgForwardRate,
    opensByDay,
    recentActivity,
  });
}

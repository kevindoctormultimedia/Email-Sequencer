import { NextResponse } from 'next/server';
import { dbAll, dbGet, dbRun } from '@/lib/db';
import { sendEmail, replaceTemplateVars } from '@/lib/email';

export async function GET() {
  // Find all active sequences with contacts that need their next email
  const sequences = await dbAll('SELECT id FROM sequences') as unknown as { id: number }[];

  let totalSent = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const seq of sequences) {
    const steps = await dbAll('SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order', [seq.id]) as unknown as {
      id: number; step_order: number; subject: string; body_html: string; delay_days: number;
    }[];

    const contacts = await dbAll(`
      SELECT * FROM contacts WHERE sequence_id = ? AND status = 'active'
    `, [seq.id]) as unknown as {
      id: number; email: string; first_name: string; last_name: string;
      company: string; domain: string; current_step: number;
    }[];

    for (const contact of contacts) {
      const nextStepOrder = (Number(contact.current_step) || 0) + 1;
      const step = steps.find(s => Number(s.step_order) === nextStepOrder);

      if (!step) {
        await dbRun("UPDATE contacts SET status = 'completed' WHERE id = ?", [contact.id]);
        totalSkipped++;
        continue;
      }

      // Check delay
      if (Number(contact.current_step) > 0) {
        const lastSent = await dbGet(`
          SELECT sent_at FROM sent_emails
          WHERE contact_id = ? AND sequence_step_id IN (SELECT id FROM sequence_steps WHERE sequence_id = ?)
          ORDER BY sent_at DESC LIMIT 1
        `, [contact.id, seq.id]) as unknown as { sent_at: string } | null;

        if (lastSent) {
          const daysSince = (Date.now() - new Date(lastSent.sent_at as string).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < Number(step.delay_days)) {
            totalSkipped++;
            continue;
          }
        }
      }

      // Skip already sent
      const alreadySent = await dbGet('SELECT id FROM sent_emails WHERE contact_id = ? AND sequence_step_id = ?', [contact.id, step.id]);
      if (alreadySent) { totalSkipped++; continue; }

      const fromNameRow = await dbGet("SELECT value FROM settings WHERE key = 'from_name'") as unknown as { value: string } | null;
      const fromName = fromNameRow?.value || '';
      const vars: Record<string, string> = {
        first_name: contact.first_name as string,
        last_name: contact.last_name as string,
        company: contact.company as string,
        domain: contact.domain as string,
        email: contact.email as string,
        your_name: fromName,
        sender_name: fromName,
      };

      const result = await sendEmail(
        contact.email as string,
        replaceTemplateVars(step.subject as string, vars),
        replaceTemplateVars(step.body_html as string, vars),
        Number(contact.id),
        Number(step.id)
      );

      if (result.success) {
        totalSent++;
        await dbRun('UPDATE contacts SET current_step = ? WHERE id = ?', [step.step_order, contact.id]);
      } else {
        totalErrors++;
      }
    }
  }

  return NextResponse.json({ sent: totalSent, skipped: totalSkipped, errors: totalErrors });
}

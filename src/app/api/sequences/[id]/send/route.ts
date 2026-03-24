import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbGet, dbRun } from '@/lib/db';
import { sendEmail, replaceTemplateVars } from '@/lib/email';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const steps = await dbAll('SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order', [id]) as unknown as {
    id: number; step_order: number; subject: string; body_html: string; delay_days: number;
  }[];

  if (steps.length === 0) {
    return NextResponse.json({ error: 'No steps in this sequence' }, { status: 400 });
  }

  const contacts = await dbAll(`
    SELECT * FROM contacts WHERE sequence_id = ? AND status = 'active'
  `, [id]) as unknown as {
    id: number; email: string; first_name: string; last_name: string;
    company: string; domain: string; current_step: number;
  }[];

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const contact of contacts) {
    // Determine which step this contact should receive
    const nextStepOrder = (Number(contact.current_step) || 0) + 1;
    const step = steps.find(s => Number(s.step_order) === nextStepOrder);

    if (!step) {
      // Contact has completed all steps
      await dbRun("UPDATE contacts SET status = 'completed' WHERE id = ?", [contact.id]);
      skipped++;
      continue;
    }

    // Check if delay has passed since last sent email
    if (Number(contact.current_step) > 0) {
      const lastSent = await dbGet(`
        SELECT sent_at FROM sent_emails
        WHERE contact_id = ? AND sequence_step_id IN (SELECT id FROM sequence_steps WHERE sequence_id = ?)
        ORDER BY sent_at DESC LIMIT 1
      `, [contact.id, id]) as unknown as { sent_at: string } | null;

      if (lastSent) {
        const lastDate = new Date(lastSent.sent_at as string);
        const now = new Date();
        const daysSince = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < Number(step.delay_days)) {
          skipped++;
          continue;
        }
      }
    }

    // Check if this step was already sent to this contact
    const alreadySent = await dbGet(`
      SELECT id FROM sent_emails WHERE contact_id = ? AND sequence_step_id = ?
    `, [contact.id, step.id]);

    if (alreadySent) {
      skipped++;
      continue;
    }

    // Replace template variables
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

    const subject = replaceTemplateVars(step.subject as string, vars);
    const body = replaceTemplateVars(step.body_html as string, vars);

    const result = await sendEmail(contact.email as string, subject, body, Number(contact.id), Number(step.id));

    if (result.success) {
      sent++;
      await dbRun('UPDATE contacts SET current_step = ? WHERE id = ?', [step.step_order, contact.id]);
    } else {
      errors++;
      console.error(`Failed to send to ${contact.email}: ${result.error}`);
    }
  }

  return NextResponse.json({ sent, skipped, errors });
}

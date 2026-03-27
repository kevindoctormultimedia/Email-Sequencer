import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbGet } from '@/lib/db';
import { replaceTemplateVars } from '@/lib/email';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const steps = await dbAll('SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order', [id]) as unknown as {
    id: number; step_order: number; subject: string; body_html: string; delay_days: number;
  }[];

  if (steps.length === 0) {
    return NextResponse.json({ error: 'No steps in this sequence' }, { status: 400 });
  }

  // Parse optional contact_ids filter from query string
  const url = new URL(_req.url);
  const contactIdsParam = url.searchParams.get('contact_ids');
  const contactIdFilter = contactIdsParam ? contactIdsParam.split(',').map(Number) : null;

  const contacts = await dbAll(`
    SELECT * FROM contacts WHERE sequence_id = ? AND status IN ('active', 'needs_review')
  `, [id]) as unknown as {
    id: number; email: string; first_name: string; last_name: string;
    company: string; domain: string; current_step: number;
  }[];

  // Get sender settings (with OAuth fallbacks)
  const fromNameRow = await dbGet("SELECT value FROM settings WHERE key = 'from_name'") as unknown as { value: string } | null;
  const fromEmailRow = await dbGet("SELECT value FROM settings WHERE key = 'from_email'") as unknown as { value: string } | null;
  const oauthEmailRow = await dbGet("SELECT value FROM settings WHERE key = 'oauth_email'") as unknown as { value: string } | null;
  const signatureRow = await dbGet("SELECT value FROM settings WHERE key = 'email_signature'") as unknown as { value: string } | null;

  const fromName = fromNameRow?.value || '';
  const fromEmail = fromEmailRow?.value || oauthEmailRow?.value || '';
  const signature = signatureRow?.value || '';

  // Build preview for each contact showing what they'd get next
  const previews = [];

  // Apply contact ID filter if provided
  const filteredContacts = contactIdFilter
    ? contacts.filter(c => contactIdFilter.includes(Number(c.id)))
    : contacts;

  for (const contact of filteredContacts) {
    const nextStepOrder = (Number(contact.current_step) || 0) + 1;
    const step = steps.find(s => Number(s.step_order) === nextStepOrder);

    if (!step) continue; // Already completed

    // Check if already sent
    const alreadySent = await dbGet(`
      SELECT id FROM sent_emails WHERE contact_id = ? AND sequence_step_id = ?
    `, [contact.id, step.id]);
    if (alreadySent) continue;

    const vars: Record<string, string> = {
      first_name: contact.first_name as string || '',
      last_name: contact.last_name as string || '',
      company: contact.company as string || '',
      domain: contact.domain as string || '',
      email: contact.email as string || '',
      your_name: fromName,
      sender_name: fromName,
    };

    const subject = replaceTemplateVars(step.subject as string, vars);
    const body = replaceTemplateVars(step.body_html as string, vars);

    // Build the full email HTML with signature
    let fullBody = body;
    if (signature) {
      fullBody += `<br/><div style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;">${signature}</div>`;
    }

    previews.push({
      contactId: contact.id,
      contactEmail: contact.email as string,
      contactName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      stepOrder: step.step_order,
      stepId: step.id,
      subject,
      body: fullBody,
      rawBody: body,
      fromName,
      fromEmail,
      hasUnresolvedVars: /\{\{[^}]+\}\}|\[[A-Z][a-z]+ [A-Z][a-z]+\]/.test(subject + body),
    });
  }

  return NextResponse.json({
    sequenceName: (await dbGet('SELECT name FROM sequences WHERE id = ?', [id]) as any)?.name || '',
    totalContacts: contacts.length,
    previewCount: previews.length,
    previews,
  });
}

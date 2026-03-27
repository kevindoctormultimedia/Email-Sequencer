import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun } from '@/lib/db';
import { sendEmail } from '@/lib/email';

// Send emails with user-edited content from the preview modal
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { emails } = await req.json() as {
    emails: {
      contactId: number;
      stepId: number;
      subject: string;
      body: string;
      contactEmail: string;
    }[];
  };

  if (!emails || emails.length === 0) {
    return NextResponse.json({ error: 'No emails provided' }, { status: 400 });
  }

  let sent = 0;
  let errors = 0;

  for (const email of emails) {
    // Verify the contact exists and belongs to this sequence
    const contact = await dbGet(
      'SELECT id, email FROM contacts WHERE id = ? AND sequence_id = ?',
      [email.contactId, id]
    );
    if (!contact) continue;

    // Verify step exists
    const step = await dbGet(
      'SELECT id, step_order FROM sequence_steps WHERE id = ? AND sequence_id = ?',
      [email.stepId, id]
    );
    if (!step) continue;

    // Check not already sent
    const alreadySent = await dbGet(
      'SELECT id FROM sent_emails WHERE contact_id = ? AND sequence_step_id = ?',
      [email.contactId, email.stepId]
    );
    if (alreadySent) continue;

    // Send with the user-edited subject/body
    const result = await sendEmail(
      email.contactEmail,
      email.subject,
      email.body, // This is the edited body from the preview
      Number(email.contactId),
      Number(email.stepId)
    );

    if (result.success) {
      sent++;
      await dbRun('UPDATE contacts SET current_step = ? WHERE id = ?', [(step as any).step_order, email.contactId]);
    } else {
      errors++;
      console.error(`Failed to send to ${email.contactEmail}: ${result.error}`);
    }
  }

  return NextResponse.json({ sent, skipped: 0, errors });
}

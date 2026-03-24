import { NextResponse } from 'next/server';
import { dbAll, dbGet } from '@/lib/db';

export async function GET() {
  const sequences = await dbAll('SELECT * FROM sequences ORDER BY created_at DESC') as unknown as {
    id: number; name: string;
  }[];

  const result = [];

  for (const seq of sequences) {
    const steps = await dbAll(`
      SELECT ss.step_order, ss.subject,
        (SELECT COUNT(*) FROM contacts WHERE sequence_id = ? AND current_step = ss.step_order) as contacts_at_step,
        (SELECT COUNT(*) FROM sent_emails WHERE sequence_step_id = ss.id AND opened_at IS NOT NULL) as opened,
        (SELECT COUNT(*) FROM sent_emails WHERE sequence_step_id = ss.id AND replied_at IS NOT NULL) as replied
      FROM sequence_steps ss
      WHERE ss.sequence_id = ?
      ORDER BY ss.step_order
    `, [seq.id, seq.id]) as unknown as { step_order: number; subject: string; contacts_at_step: number; opened: number; replied: number }[];

    const totalContactsRow = await dbGet('SELECT COUNT(*) as count FROM contacts WHERE sequence_id = ?', [seq.id]) as unknown as { count: number };
    const totalContacts = Number(totalContactsRow.count);

    result.push({
      id: seq.id,
      name: seq.name,
      steps,
      totalContacts,
    });
  }

  return NextResponse.json({ sequences: result });
}

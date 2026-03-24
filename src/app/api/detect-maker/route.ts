import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun } from '@/lib/db';
import { scrapeWebsiteMaker } from '@/lib/scraper';

export async function POST(req: NextRequest) {
  const { contact_id } = await req.json();

  const contact = await dbGet('SELECT * FROM contacts WHERE id = ?', [contact_id]) as unknown as {
    id: number; domain: string;
  } | null;

  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  try {
    const result = await scrapeWebsiteMaker(contact.domain as string);

    if (result.confidence > 0.7 && result.maker !== 'Unknown') {
      let sequence = await dbGet('SELECT id FROM sequences WHERE website_maker_pattern = ?', [result.maker]) as unknown as { id: number } | null;

      if (!sequence) {
        const res = await dbRun('INSERT INTO sequences (name, website_maker_pattern, description) VALUES (?, ?, ?)', [
          `${result.maker} Sequence`,
          result.maker,
          `Auto-created for websites built by ${result.maker}`
        ]);
        sequence = { id: Number(res.lastInsertRowid) };
      }

      await dbRun("UPDATE contacts SET website_maker = ?, website_maker_confidence = ?, sequence_id = ?, status = 'active' WHERE id = ?", [
        result.maker, result.confidence, sequence.id, contact_id
      ]);
    } else {
      await dbRun("UPDATE contacts SET website_maker = ?, website_maker_confidence = ?, status = 'needs_review' WHERE id = ?", [
        result.maker || 'Unknown', result.confidence, contact_id
      ]);
    }

    return NextResponse.json({ success: true, maker: result.maker, confidence: result.confidence });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

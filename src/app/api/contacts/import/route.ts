import { NextRequest, NextResponse } from 'next/server';
import { dbRun, dbGet } from '@/lib/db';
import { parse } from 'csv-parse/sync';
import { scrapeWebsiteMaker } from '@/lib/scraper';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const text = await file.text();
  let records: Record<string, string>[];

  try {
    records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 });
  }

  let imported = 0;
  const domains = new Set<string>();

  for (const row of records) {
    const email = row.email || row.Email || row.EMAIL || '';
    if (!email || !email.includes('@')) continue;

    const domain = email.split('@')[1];
    const result = await dbRun(`
      INSERT OR IGNORE INTO contacts (email, domain, first_name, last_name, company, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `, [
      email.toLowerCase().trim(),
      domain,
      row.first_name || row.FirstName || row.firstName || '',
      row.last_name || row.LastName || row.lastName || '',
      row.company || row.Company || row.COMPANY || ''
    ]);

    if (result.rowsAffected > 0) {
      imported++;
      domains.add(domain);
    }
  }

  // Kick off AI detection in the background (non-blocking)
  const domainsArray = Array.from(domains);
  detectMakersInBackground(domainsArray).catch(console.error);

  return NextResponse.json({ imported, detecting: domainsArray.length });
}

async function detectMakersInBackground(domains: string[]) {
  for (const domain of domains) {
    try {
      const result = await scrapeWebsiteMaker(domain);

      if (result.confidence > 0.7 && result.maker !== 'Unknown') {
        // Find or create sequence for this maker
        let sequence = await dbGet('SELECT id FROM sequences WHERE website_maker_pattern = ?', [result.maker]) as unknown as { id: number } | null;

        if (!sequence) {
          const res = await dbRun('INSERT INTO sequences (name, website_maker_pattern, description) VALUES (?, ?, ?)', [
            `${result.maker} Sequence`,
            result.maker,
            `Auto-created for websites built by ${result.maker}`
          ]);
          sequence = { id: Number(res.lastInsertRowid) };
        }

        // Update contacts with this domain
        await dbRun(`
          UPDATE contacts
          SET website_maker = ?, website_maker_confidence = ?, sequence_id = ?, status = 'active'
          WHERE domain = ? AND (website_maker IS NULL OR website_maker = '')
        `, [result.maker, result.confidence, sequence.id, domain]);
      } else {
        // Low confidence -- mark for review
        await dbRun(`
          UPDATE contacts
          SET website_maker = ?, website_maker_confidence = ?, status = 'needs_review'
          WHERE domain = ? AND (website_maker IS NULL OR website_maker = '')
        `, [result.maker || 'Unknown', result.confidence, domain]);
      }
    } catch (err) {
      console.error(`Failed to detect maker for ${domain}:`, err);
      await dbRun(`
        UPDATE contacts SET status = 'needs_review'
        WHERE domain = ? AND (website_maker IS NULL OR website_maker = '')
      `, [domain]);
    }
  }
}

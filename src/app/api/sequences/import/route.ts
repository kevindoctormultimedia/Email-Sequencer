import { NextRequest, NextResponse } from 'next/server';
import { dbRun } from '@/lib/db';
import mammoth from 'mammoth';

interface ParsedEmail {
  stepOrder: number;
  delayDays: number;
  subject: string;
  bodyHtml: string;
}

interface ParsedSequence {
  name: string;
  description: string;
  websiteMakerPattern: string;
  emails: ParsedEmail[];
}

function parseSequenceFromText(text: string): ParsedSequence {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Extract sequence name from the first line (e.g. "5-EMAIL COLD OUTREACH SEQUENCE")
  let name = '';
  let description = '';
  let websiteMakerPattern = '';

  // Look for the title and target info
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (line.match(/sequence$/i) || line.match(/^\d+-email/i)) {
      name = line;
    }
    if (line.match(/^target:/i)) {
      description = line;
    }
    // Try to extract the website maker pattern from the target line
    // e.g. "GrowthPlug Dental Practices" -> "GrowthPlug"
    if (line.match(/^(target|goal|tone|cadence):/i)) {
      // Check if the previous line mentions a company name that could be the maker
      if (i > 0 && !lines[i-1].match(/sequence$/i) && !lines[i-1].match(/\|/)) {
        // Could be the target company name
      }
    }
  }

  // Try to extract maker pattern from the first few lines
  // Look for the company being targeted (e.g. "GrowthPlug Dental Practices")
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    // Skip the title line and company line
    if (!line.match(/sequence$/i) && !line.match(/\|/) && !line.match(/^(target|goal|tone|cadence|sequence overview):/i) && line.length < 50) {
      // This might be the target company name e.g. "GrowthPlug Dental Practices"
      const words = line.split(/\s+/);
      if (words.length <= 5 && !websiteMakerPattern) {
        websiteMakerPattern = words[0]; // Take the first word as the maker pattern
        if (!description) description = `Cold outreach for ${line}`;
      }
    }
  }

  // Parse emails - look for patterns like "EMAIL 1 // Day 1" or "Email #1" etc.
  const emailRegex = /EMAIL\s*(\d+)\s*(?:\/\/|—|-|:)\s*Day\s*(\d+)/gi;

  // Split text into email blocks
  const emailBlocks: { num: number; day: number; content: string }[] = [];
  const emailMarkers: { index: number; num: number; day: number }[] = [];

  // Find all email markers
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    emailMarkers.push({
      index: match.index,
      num: parseInt(match[1]),
      day: parseInt(match[2]),
    });
  }

  // Extract content between email markers
  for (let i = 0; i < emailMarkers.length; i++) {
    const start = emailMarkers[i].index;
    const end = i + 1 < emailMarkers.length ? emailMarkers[i + 1].index : text.length;
    const content = text.slice(start, end);

    // Remove strategy note section
    const strategyIdx = content.search(/STRATEGY\s*NOTE/i);
    const emailContent = strategyIdx > -1 ? content.slice(0, strategyIdx) : content;

    emailBlocks.push({
      num: emailMarkers[i].num,
      day: emailMarkers[i].day,
      content: emailContent.trim(),
    });
  }

  // Parse each email block into subject + body
  const emails: ParsedEmail[] = emailBlocks.map((block, idx) => {
    const blockLines = block.content.split('\n').map(l => l.trim());

    // Find subject line
    let subject = '';
    let bodyStartIdx = 0;

    for (let i = 0; i < blockLines.length; i++) {
      const subMatch = blockLines[i].match(/^Subject:\s*(.+)$/i);
      if (subMatch) {
        subject = subMatch[1].trim();
        bodyStartIdx = i + 1;
        break;
      }
    }

    // Extract body - skip empty lines at start, stop at strategy note or signature patterns
    const bodyLines: string[] = [];
    let inBody = false;
    let hitSignature = false;

    for (let i = bodyStartIdx; i < blockLines.length; i++) {
      const line = blockLines[i];

      // Skip the "EMAIL X // Day Y" header line
      if (line.match(/^EMAIL\s*\d+/i)) continue;

      // Start collecting after the greeting
      if (line.match(/^Hi\s+(Dr\.|Mr\.|Mrs\.|Ms\.)/i) || line.match(/^Hello/i) || line.match(/^Hey/i)) {
        inBody = true;
      }

      if (inBody) {
        // Stop at strategy notes
        if (line.match(/^STRATEGY\s*NOTE/i)) break;
        // Stop at tips section
        if (line.match(/^TIPS\s+FOR/i)) break;

        // Check for signature (company name, website pattern)
        if (line.match(/^(Doctor\s+Multimedia|doctormultimedia)/i) || line.match(/\.com$/i)) {
          hitSignature = true;
          continue;
        }
        if (hitSignature && line === '') continue;
        if (hitSignature && !line.match(/^(Best|Regards|Thanks|Sincerely|Cheers)/i)) {
          hitSignature = false;
        }

        // Skip signature lines
        if (line.match(/^\[Your\s+Name\]/i)) continue;
        if (line.match(/^(Best|Regards|Thanks|Sincerely|Cheers),?$/i)) continue;

        bodyLines.push(line);
      }
    }

    // Convert body to HTML paragraphs
    const bodyText = bodyLines.join('\n');
    const paragraphs = bodyText.split(/\n\n+/).filter(Boolean);
    const bodyHtml = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');

    // Calculate delay days
    const prevDay = idx > 0 ? emailBlocks[idx - 1].day : 0;
    const delayDays = block.day - prevDay;

    return {
      stepOrder: block.num,
      delayDays: Math.max(delayDays, 1),
      subject,
      bodyHtml,
    };
  });

  return {
    name: name || 'Imported Sequence',
    description: description || '',
    websiteMakerPattern: websiteMakerPattern || '',
    emails,
  };
}

// POST: Upload and parse a .docx file, return preview
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const action = formData.get('action') as string; // 'preview' or 'import'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text from docx
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    // Parse the sequence
    const parsed = parseSequenceFromText(text);

    if (action === 'preview') {
      return NextResponse.json({ parsed, rawText: text.slice(0, 2000) });
    }

    // action === 'import' -- actually create the sequence and steps

    // Allow overrides from form data
    const overrideName = formData.get('name') as string;
    const overridePattern = formData.get('pattern') as string;
    const overrideDescription = formData.get('description') as string;

    const seqResult = await dbRun(
      'INSERT INTO sequences (name, website_maker_pattern, description) VALUES (?, ?, ?)',
      [
        overrideName || parsed.name,
        overridePattern ?? parsed.websiteMakerPattern,
        overrideDescription || parsed.description
      ]
    );

    const seqId = seqResult.lastInsertRowid;

    // Insert all steps
    for (const email of parsed.emails) {
      await dbRun(
        'INSERT INTO sequence_steps (sequence_id, step_order, subject, body_html, delay_days) VALUES (?, ?, ?, ?, ?)',
        [seqId, email.stepOrder, email.subject, email.bodyHtml, email.delayDays]
      );
    }

    return NextResponse.json({
      id: seqId,
      name: overrideName || parsed.name,
      stepsCreated: parsed.emails.length,
    });
  } catch (err: unknown) {
    console.error('Sequence import error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    );
  }
}

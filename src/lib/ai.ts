import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbGet } from './db';

async function getGemini() {
  const row = await dbGet("SELECT value FROM settings WHERE key = 'gemini_api_key'") as unknown as { value: string } | null;
  if (!row?.value) throw new Error('Gemini API key not configured. Go to Settings to add it.');
  return new GoogleGenerativeAI(row.value as string);
}

export async function detectWebsiteMaker(footerText: string, metaTags: string, domain: string): Promise<{ maker: string; confidence: number }> {
  const genAI = await getGemini();
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

  const prompt = `Analyze this website footer content and meta tags to identify the website platform/maker/builder company.

Domain: ${domain}

Footer content:
${footerText.slice(0, 2000)}

Meta tags:
${metaTags.slice(0, 1000)}

Common website makers include: iMatrix, Inception, WordPress, Wix, Squarespace, Shopify, GoDaddy, Weebly, etc.
Also look for custom agency names that built the site.

Respond in JSON format only:
{"maker": "CompanyName", "confidence": 0.85}

If you cannot determine the maker, respond:
{"maker": "Unknown", "confidence": 0.0}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // fall through
  }
  return { maker: 'Unknown', confidence: 0 };
}

export async function generateABVariants(
  originalSubject: string,
  originalBody: string,
  sequenceName: string,
  pastInsights: string
): Promise<{ subject: string; body_html: string }[]> {
  const genAI = await getGemini();
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

  const prompt = `Generate 2 A/B test email variants for an email marketing sequence.

Sequence: ${sequenceName}
Original Subject: ${originalSubject}
Original Body (first 500 chars): ${originalBody.slice(0, 500)}

Past ML Insights (what has worked before):
${pastInsights || 'No previous data yet.'}

Generate 2 alternative versions that test different approaches (subject line style, CTA, tone, etc.).
Respond in JSON array format only:
[
  {"subject": "Variant A subject", "body_html": "<p>Variant A body...</p>"},
  {"subject": "Variant B subject", "body_html": "<p>Variant B body...</p>"}
]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // fall through
  }
  return [];
}

export async function analyzeABTestResults(
  variants: { name: string; sends: number; opens: number; replies: number }[]
): Promise<{ winner: string; reasoning: string; insights: string[] }> {
  const genAI = await getGemini();
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

  const prompt = `Analyze these A/B test email results and determine the winner.

Variants:
${variants.map(v => `- ${v.name}: ${v.sends} sent, ${v.opens} opens (${v.sends > 0 ? ((v.opens / v.sends) * 100).toFixed(1) : 0}%), ${v.replies} replies (${v.sends > 0 ? ((v.replies / v.sends) * 100).toFixed(1) : 0}%)`).join('\n')}

Consider statistical significance. If sample size is too small (< 30 per variant), note that.

Respond in JSON format only:
{
  "winner": "variant_name",
  "reasoning": "Why this variant won...",
  "insights": ["Insight 1 about what worked", "Insight 2..."]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // fall through
  }
  return { winner: '', reasoning: 'Could not analyze results', insights: [] };
}

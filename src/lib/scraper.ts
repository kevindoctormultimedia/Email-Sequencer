import * as cheerio from 'cheerio';
import { detectWebsiteMaker } from './ai';

export async function scrapeWebsiteMaker(domain: string): Promise<{ maker: string; confidence: number; footerText: string }> {
  const urls = [`https://${domain}`, `https://www.${domain}`];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract footer content
      const footerSelectors = ['footer', '#footer', '.footer', '[role="contentinfo"]', '.site-footer', '#site-footer'];
      let footerText = '';
      for (const sel of footerSelectors) {
        const el = $(sel);
        if (el.length) {
          footerText = el.text().replace(/\s+/g, ' ').trim();
          break;
        }
      }

      // If no footer found, grab bottom 20% of body text
      if (!footerText) {
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
        const startIdx = Math.floor(bodyText.length * 0.8);
        footerText = bodyText.slice(startIdx);
      }

      // Extract meta tags
      const metaTags: string[] = [];
      $('meta').each((_, el) => {
        const name = $(el).attr('name') || $(el).attr('property') || '';
        const content = $(el).attr('content') || '';
        if (name && content) {
          metaTags.push(`${name}: ${content}`);
        }
      });

      // Check for generator meta tag (quick win)
      const generator = $('meta[name="generator"]').attr('content') || '';
      if (generator) {
        metaTags.unshift(`generator: ${generator}`);
      }

      // Also check for common CMS indicators in HTML comments
      const htmlStr = html.slice(0, 5000);
      const commentMatches = htmlStr.match(/<!--[\s\S]*?-->/g) || [];
      const relevantComments = commentMatches
        .filter(c => /powered|built|theme|platform|cms/i.test(c))
        .join(' ');

      const fullMetaText = metaTags.join('\n') + (relevantComments ? '\n' + relevantComments : '');

      const result = await detectWebsiteMaker(footerText, fullMetaText, domain);
      return { ...result, footerText: footerText.slice(0, 500) };
    } catch {
      continue;
    }
  }

  return { maker: 'Unknown', confidence: 0, footerText: '' };
}

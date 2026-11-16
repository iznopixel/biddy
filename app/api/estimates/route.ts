import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { extract } from '../../../lib/extract';
import { quickBooks, QuickBooksError, type EstimateLine } from '../../../lib/quickbooks';

export const maxDuration = 60;

const bodySchema = z.object({
  transcript: z.string().trim().min(1).max(8000),
  dryRun: z.boolean().optional(),
});

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

function reply(status: string, message: string, code = 200) {
  return Response.json({ status, message }, { status: code });
}

function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

function containsPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?:^|[^\\p{L}\\p{N}])' + escaped + '(?![\\p{L}\\p{N}])', 'u').test(text);
}

function readCents(price: string) {
  if (!/^\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(price)) return null;
  const cents = Math.round(Number(price.replace(/[$,]/g, '')) * 100);
  return Number.isSafeInteger(cents) && cents <= 9999999999 ? cents : null;
}

export async function POST(request: Request) {
  const secret = process.env.BIDDY_SECRET;
  if (!secret) return reply('error', 'Biddy has not been configured.', 503);
  if (!timingSafeEqual(digest('Bearer ' + secret), digest(request.headers.get('authorization') ?? ''))) {
    return reply('error', 'Check the Biddy secret in your Shortcut.', 401);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply('needs_attention', 'Dictate a job description of up to 8,000 characters.');
  const { transcript, dryRun } = parsed.data;

  let creating = false;
  try {
    const qb = await quickBooks();
    const [customers, services] = await Promise.all([qb.customers(), qb.services()]);
    const draft = await extract(transcript, services.map(service => ({
      id: service.Id,
      name: service.FullyQualifiedName ?? service.Name,
      description: service.Description,
    })));

    const issues = [...draft.issues.filter(issue => issue.trim())];
    const mentionedName = normalize(draft.customerName ?? '');
    const matches = mentionedName && containsPhrase(normalize(transcript), mentionedName)
      ? customers.filter(customer => [customer.DisplayName, customer.FullyQualifiedName]
        .some(name => name && normalize(name) === mentionedName))
      : [];
    if (matches.length !== 1) issues.push('Say the unique customer name exactly as it appears in QuickBooks.');
    if (!draft.deliverables.length) issues.push('Dictate at least one deliverable and its fixed price.');

    const lines: EstimateLine[] = [];
    for (const [index, line] of draft.deliverables.entries()) {
      const description = line.description.trim();
      const evidence = line.evidence.trim();
      const price = line.priceText?.trim() ?? '';
      const cents = readCents(price);
      const service = services.find(item => item.Id === line.serviceId);
      const verifiedPrice = cents !== null && evidence && transcript.includes(evidence) &&
        [...evidence.matchAll(/\$?\d[\d,]*(?:\.\d+)?/g)]
          .some(match => match[0].replace(/,$/, '') === price);
      if (!description || description.length > 4000) issues.push('Clarify the description for line ' + (index + 1) + '.');
      if (!verifiedPrice) issues.push('Give an explicit fixed price for line ' + (index + 1) + '.');
      if (!service) issues.push('Specify an existing QuickBooks service for line ' + (index + 1) + '.');
      if (description && verifiedPrice && service) lines.push({ description, cents, serviceId: service.Id });
    }

    if (issues.length) {
      return Response.json({
        status: 'needs_attention',
        message: 'Needs attention. ' + [...new Set(issues)].join(' '),
        draft,
      });
    }
    const customer = matches[0];
    if (dryRun) return Response.json({ status: 'ready', message: 'Estimate is ready for ' + customer.DisplayName + '.', draft, lines });

    creating = true;
    const estimate = await qb.createEstimate(customer.Id, lines);
    return Response.json({
      status: 'created',
      message: 'Created unsent sandbox estimate ' + (estimate.DocNumber ?? estimate.Id) + ' for ' + customer.DisplayName + '.',
      estimateId: estimate.Id,
      estimateNumber: estimate.DocNumber ?? null,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof QuickBooksError && error.status === 401) {
      return reply('error', 'The QuickBooks sandbox connection needs a fresh access token.');
    }
    if (creating) return reply('error', 'Check QuickBooks for the estimate before trying again. Biddy could not confirm creation.');
    return reply('error', 'Biddy could not prepare the estimate. Check the sandbox and Gemini configuration.');
  }
}

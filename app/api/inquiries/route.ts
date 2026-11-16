import { inquirySchema } from '../../../lib/intake/inquiry';
import { notifyContractor } from '../../../lib/intake/notify';

const maxBodyBytes = 64 * 1024;
const received = 'Thank you. We received your project inquiry and will follow up using the details you provided.';

function reply(message: string, status: number) {
  return Response.json({ message }, { status });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply('Please submit from the inquiry page.', 403);
  const contentType = request.headers.get('content-type')?.split(';', 1)[0];
  if (contentType !== 'application/x-www-form-urlencoded' || !request.body) {
    return reply('Please submit from the inquiry page.', 415);
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBodyBytes) {
        await reader.cancel();
        return reply('The inquiry is too long.', 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch {
    return reply('The inquiry could not be read. Please try again.', 400);
  }

  const fields = new URLSearchParams(body);
  if (fields.get('website')) return reply(received, 202);
  const parsed = inquirySchema.safeParse(Object.fromEntries(fields));
  if (!parsed.success) return reply('Check your contact details, project address, and description, then try again.', 422);

  try {
    await notifyContractor(parsed.data);
    return reply(received, 202);
  } catch {
    return reply('We couldn’t confirm your inquiry. Please try again in a moment.', 503);
  }
}

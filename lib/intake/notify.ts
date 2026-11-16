import type { Inquiry } from './inquiry';

export async function notifyContractor(inquiry: Inquiry) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INQUIRY_FROM_EMAIL;
  const to = process.env.INQUIRY_TO_EMAIL;
  if (!key || !from || !to) throw new Error('Inquiry email is not configured');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [to], reply_to: inquiry.email,
      subject: 'New OZ Construction project inquiry',
      text: [
        'Name: ' + inquiry.name,
        'Email: ' + inquiry.email,
        'Phone: ' + inquiry.phone,
        'Project address: ' + inquiry.address,
        '',
        'Project description:',
        inquiry.description,
      ].join('\n'),
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Inquiry email delivery request failed');
}

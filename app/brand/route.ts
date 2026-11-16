import { logo } from './logo';

export function GET() {
  return new Response(new Uint8Array(Buffer.from(logo, 'base64')), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' },
  });
}

'use client';

import { useState, type FormEvent } from 'react';

export function InquiryForm() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    setPending(true);
    setResult(null);
    try {
      const response = await fetch('/api/inquiries', { method: 'POST', body: new URLSearchParams(
        Array.from(new FormData(form), ([key, value]) => [key, String(value)]),
      ) });
      const { message } = await response.json();
      setResult({ ok: response.ok, message });
      if (response.ok) form.reset();
    } catch {
      setResult({ ok: false, message: 'We couldn’t confirm your submission. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" action="/api/inquiries" onSubmit={submit}>
      <label>Full name<input name="name" autoComplete="name" maxLength={120} required /></label>
      <div className="row">
        <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40} required /></label>
      </div>
      <label>Project address<input name="address" autoComplete="street-address" maxLength={240} required /></label>
      <label>Project description<textarea name="description" rows={5} maxLength={4000} required placeholder="What work are you looking to have done?" /></label>
      <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <p className="note">We’ll use your contact details to follow up about this project.</p>
      <button disabled={pending} type="submit">{pending ? 'Sending…' : 'Send inquiry'} <span aria-hidden="true">↗</span></button>
      <div aria-live="polite" aria-atomic="true">
        {result && <p className={result.ok ? 'success' : 'error'}>{result.message}</p>}
      </div>
    </form>
  );
}

'use client';
import { useId, useState } from 'react';
import { api } from '../lib/client-api.mjs';

export default function ContactForm({ topic }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  if (sent) return <div className="legal-contact-success" role="status"><strong>Message received.</strong><p>Your request is in the team’s private inbox. Keep an eye on the email address you provided.</p></div>;
  return <form className="legal-contact-form" onSubmit={async (event) => {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      await api('sponsor', { name: fields.name, email: fields.email, url: location.origin, message: `[${topic}]\n${fields.message}` });
      setSent(true);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }}>
    <div className="legal-contact-fields">
      <div className="field"><label htmlFor={`${id}-name`}>Your name</label><input id={`${id}-name`} name="name" required maxLength={80} autoComplete="name" /></div>
      <div className="field"><label htmlFor={`${id}-email`}>Reply email</label><input id={`${id}-email`} name="email" type="email" required maxLength={254} autoComplete="email" /></div>
    </div>
    <div className="field"><label htmlFor={`${id}-message`}>How can we help?</label><textarea id={`${id}-message`} name="message" required minLength={10} maxLength={1900} rows={5} aria-describedby={`${id}-hint`} /><small id={`${id}-hint`}>Please leave out passwords, tokens, and sensitive documents.</small></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" disabled={busy}>{busy ? 'Sending…' : 'Send a private message'} <span aria-hidden="true">↗</span></button>
  </form>;
}

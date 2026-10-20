'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Upload, RefreshCw, X, LoaderCircle, ImagePlus } from 'lucide-react';
import '../app/covers.css';
import { api } from '../lib/client-api.mjs';

export function useProductCover(initialCover = null) {
  const [cover, setCover] = useState(initialCover);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const current = useRef(0),
    controller = useRef(null);
  useEffect(
    () => () => {
      current.current++;
      controller.current?.abort();
    },
    [],
  );
  function cancel() {
    current.current++;
    controller.current?.abort();
    setStatus('idle');
    setError('');
  }
  async function request(endpoint, body, kind) {
    cancel();
    const version = current.current;
    const abort = new AbortController();
    controller.current = abort;
    setStatus(kind);
    const timeout = setTimeout(() => abort.abort(), 35000);
    try {
      const result = await api(`covers/${endpoint}`, body, { signal: abort.signal });
      if (version === current.current) {
        setCover(result.cover);
        setStatus('idle');
      }
    } catch (failure) {
      if (version === current.current) {
        setError(
          failure.name === 'AbortError'
            ? 'That took too long. Try again, upload an image, or skip the cover.'
            : failure.message,
        );
        setStatus('idle');
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    cover,
    status,
    error,
    busy: status !== 'idle',
    clear() {
      cancel();
      setCover(null);
    },
    capture(url, refresh = false) {
      return request('capture', { url, refresh }, 'capturing');
    },
    upload(file) {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        setError('Keep your image under 5 MB.');
        return;
      }
      const form = new FormData();
      form.set('file', file);
      return request('upload', form, 'uploading');
    },
  };
}

export default function CoverEditor({ state, website, name = 'Your product' }) {
  const inputId = useId();
  const { cover, status, error, busy } = state;
  return (
    <section className="cover-editor" aria-label="Product cover">
      <div className="cover-editor-heading">
        <h3>A little window into your world.</h3>
        <p>Keep the website preview, or give it your own cover.</p>
      </div>
      <div className={`cover-stage ${cover ? 'has-cover' : ''}`} aria-busy={busy}>
        {cover?.url ? (
          <img src={cover.url} alt={`${name} cover preview`} width="1600" height="1200" />
        ) : (
          <div className="cover-placeholder">
            <ImagePlus size={32} />
            <span>Your next first impression.</span>
          </div>
        )}
        {busy && (
          <div className="cover-loading" role="status">
            <LoaderCircle size={24} className="spin" />
            <strong>
              {status === 'capturing' ? 'Taking a little look…' : 'Making room for your cover…'}
            </strong>
            <small>
              {status === 'capturing' ? 'You can keep filling things in.' : 'Almost there.'}
            </small>
          </div>
        )}
        {cover?.url && !busy && (
          <span className="cover-kind">
            {cover.kind === 'capture' ? 'Captured from your website' : 'Your uploaded cover'}
          </span>
        )}
      </div>
      <div className="cover-controls">
        <label className="cover-upload" htmlFor={inputId}>
          <Upload size={15} /> {cover ? 'Replace image' : 'Upload a cover'}
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Upload cover image"
            onChange={(event) => {
              void state.upload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => state.capture(website, true)}
          disabled={busy || !website}
        >
          {cover ? <RefreshCw size={15} /> : <Camera size={15} />}{' '}
          {cover ? 'Retake website' : 'Capture website'}
        </button>
        {(cover || busy) && (
          <button type="button" onClick={state.clear}>
            <X size={15} /> {busy ? 'Skip cover' : 'Remove'}
          </button>
        )}
      </div>
      <p className="cover-hint">JPG, PNG, or WebP · up to 5 MB. A 4:3 image fits best. Optional.</p>
      {cover && !cover.url && !busy && <p className="cover-hint" role="status">Your website preview is queued. You can submit now or upload your own image.</p>}
      {error && (
        <p className="cover-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

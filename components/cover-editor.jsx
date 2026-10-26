'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Upload, RefreshCw, X, LoaderCircle, ImagePlus, Film } from 'lucide-react';
import WorkMedia from './work-media';
import { VIDEO_POLICY } from '../supabase/functions/_shared/video.mjs';
import '../app/covers.css';
import { api } from '../lib/client-api.mjs';

export function useProductCover(initialCover = null) {
  const [cover, setCover] = useState(initialCover);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
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
    setProgress('');
  }
  async function request(endpoint, body, kind) {
    cancel();
    const version = current.current;
    const abort = new AbortController();
    controller.current = abort;
    setStatus(kind);
    const timeout = setTimeout(() => abort.abort(), kind === 'video' ? 180000 : 35000);
    try {
      const result = await api(kind === 'video' ? 'videos/upload' : `covers/${endpoint}`, body, {
        signal: abort.signal,
        onProgress: (message) => {
          if (version === current.current) setProgress(message);
        },
      });
      if (version === current.current) {
        setCover(result.cover);
        setStatus('idle');
      }
    } catch (failure) {
      if (version === current.current) {
        setError(
          failure.name === 'AbortError'
            ? 'That took too long. Please try again or choose a smaller file.'
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
    progress,
    busy: status !== 'idle',
    clear() {
      cancel();
      setCover(null);
    },
    capture(url, refresh = false) {
      return request('capture', { url, refresh }, 'capturing');
    },
    uploadVideo(file) {
      if (!file) return;
      if (file.size > VIDEO_POLICY.sourceBytes) {
        setError('Choose a video under 100 MB. We will try to compress it.');
        return;
      }
      const form = new FormData();
      form.set('file', file);
      return request('upload', form, 'video');
    },
    upload(file) {
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) {
        setError('Choose an image under 25 MB. We’ll resize it for you.');
        return;
      }
      const form = new FormData();
      form.set('file', file);
      return request('upload', form, 'uploading');
    },
  };
}

export default function CoverEditor({
  state,
  website,
  name = 'Your work',
  artwork = false,
  allowVideo = false,
  removable = true,
}) {
  const inputId = useId();
  const { cover, status, error, busy } = state;
  return (
    <section
      className={`cover-editor ${artwork ? 'artwork-upload' : ''}`}
      aria-label={artwork ? 'Photo of your work' : 'Product cover'}
    >
      <div className="cover-editor-heading">
        <h3>{artwork ? 'Let’s see what you made.' : 'Give it a first impression.'}</h3>
        <p>
          {artwork
            ? allowVideo
              ? 'A photo or a little clip. We keep the whole picture.'
              : 'A photo from your phone is perfect. We keep the whole image.'
            : 'Upload an image or capture your website. You can also skip this.'}
        </p>
      </div>
      <div className={`cover-stage ${cover ? 'has-cover' : ''}`} aria-busy={busy}>
        {cover?.url ? (
          <WorkMedia key={cover.id} cover={cover} name={name} alt={`${name} cover preview`} />
        ) : (
          <div className="cover-placeholder">
            <ImagePlus size={32} />
            <span>{artwork ? 'Your work belongs here.' : 'Your next first impression.'}</span>
          </div>
        )}
        {busy && (
          <div className="cover-loading" role="status">
            <LoaderCircle size={24} className="spin" />
            <strong>
              {status === 'capturing'
                ? 'Taking a little look…'
                : status === 'video'
                  ? state.progress || 'Preparing your clip…'
                  : 'Preparing your image…'}
            </strong>
            <small>
              {status === 'capturing' ? 'You can keep filling things in.' : 'Almost there.'}
            </small>
          </div>
        )}
        {cover?.url && !busy && !cover.video && (
          <span className="cover-kind">
            {cover.kind === 'capture' ? 'Captured from your website' : 'Image ready'}
          </span>
        )}
      </div>
      <div className="cover-controls">
        <label className="cover-upload" htmlFor={inputId}>
          <Upload size={15} />{' '}
          {cover ? 'Replace image' : artwork ? 'Add a photo' : 'Upload a cover'}
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={artwork ? 'Add a photo of your work' : 'Upload cover image'}
            aria-describedby={`${inputId}-hint`}
            disabled={busy}
            onChange={(event) => {
              void state.upload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        {allowVideo && (
          <label className="cover-upload">
            <Film size={15} />
            {cover?.video ? 'Replace video' : 'Add a video'}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.mov,.webm"
              aria-label="Add a video of your work"
              disabled={busy}
              onChange={(event) => {
                void state.uploadVideo(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
        )}
        {!artwork && (
          <button
            type="button"
            onClick={() => state.capture(website, true)}
            disabled={busy || !website}
          >
            {cover ? <RefreshCw size={15} /> : <Camera size={15} />}{' '}
            {cover ? 'Retake website' : 'Capture website'}
          </button>
        )}
        {(busy || (cover && removable)) && (
          <button type="button" onClick={state.clear}>
            <X size={15} /> {busy ? 'Cancel upload' : 'Remove'}
          </button>
        )}
      </div>
      <p id={`${inputId}-hint`} className="cover-hint">
        JPG, PNG, or WebP · up to 25 MB. We resize it for you.{!artwork && ' Optional.'}
        {allowVideo && (
          <>
            <br />
            Video: MP4, MOV or WebM · up to {VIDEO_POLICY.seconds} seconds. We try to compress
            originals up to 100 MB to fit a 5 MB upload.
          </>
        )}
      </p>
      {cover?.url && !busy && (
        <span className="sr-only" role="status">
          {cover.video ? 'Your video is ready.' : 'Your image is ready.'}
        </span>
      )}
      {cover && !cover.url && !busy && (
        <p className="cover-hint" role="status">
          Your website preview is queued. You can submit now or upload your own image.
        </p>
      )}
      {error && (
        <p className="cover-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

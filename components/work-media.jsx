'use client';
import { useEffect, useRef, useState } from 'react';
import { Play, LoaderCircle } from 'lucide-react';
import { api } from '../lib/client-api.mjs';
import '../app/video-posts.css';

export function VideoBadge({ video }) {
  if (!video) return null;
  const seconds = Math.round(video.duration);
  return (
    <span className="video-badge">
      <Play size={12} fill="currentColor" aria-hidden="true" />
      <span>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </span>
      <span className="sr-only"> video</span>
    </span>
  );
}
export default function WorkMedia({ cover, name, alt }) {
  const [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const player = useRef(null),
    request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  useEffect(() => {
    const el = player.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) el.pause();
    });
    observer.observe(el);
    const hidden = () => {
      if (document.hidden) el.pause();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', hidden);
      el.pause();
    };
  }, [url]);
  if (!cover?.video) return <img src={cover?.url} alt={alt || name} width="1600" height="1200" />;
  return (
    <div
      className="work-media"
      style={{ '--video-ratio': `${cover.video.width} / ${cover.video.height}` }}
    >
      {url ? (
        <video
          ref={player}
          controls
          playsInline
          autoPlay
          preload="metadata"
          poster={cover.url}
          src={url}
          aria-label={`${name} video`}
          onError={() => {
            setUrl('');
            setError('This video could not play. Tap to try again.');
          }}
        />
      ) : (
        <button
          type="button"
          className="video-play"
          disabled={busy}
          aria-label={`Play ${name} video`}
          onClick={async () => {
            const version = ++request.current;
            setBusy(true);
            setError('');
            try {
              const result = await api('videos/play', { id: cover.video.id });
              if (version === request.current) setUrl(result.video.url);
            } catch (e) {
              if (version === request.current) setError(e.message);
            } finally {
              if (version === request.current) setBusy(false);
            }
          }}
        >
          <img src={cover.url} alt={alt || `${name} video cover`} />
          <span className="video-play-label">
            {busy ? (
              <LoaderCircle className="spin" size={22} />
            ) : (
              <Play size={22} fill="currentColor" />
            )}
            {busy ? 'Opening…' : 'Play video'}
          </span>
          <VideoBadge video={cover.video} />
        </button>
      )}
      {error && (
        <p className="video-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

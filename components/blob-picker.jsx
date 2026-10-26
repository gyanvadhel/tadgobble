'use client';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Shuffle, Upload, Check } from 'lucide-react';
import { BlobFace, Avatar } from './blob-avatar';
import { blobShapes, blobColors, blobMoods, defaultBlob } from '../lib/blob-options.mjs';

export default function BlobPicker({
  value = defaultBlob,
  onChange,
  photo,
  mode,
  onModeChange,
  disabled = false,
  preview = true,
}) {
  const change = (key, v) => onChange({ ...value, [key]: v });
  const shape = blobShapes.find((s) => s.id === value.shape) || blobShapes[0];
  // Each pick squashes the new blob in and lets it settle with a wobble.
  const stage = useRef(null),
    look = JSON.stringify(value),
    seen = useRef(look);
  useEffect(() => {
    if (seen.current === look) return;
    seen.current = look;
    const blob = stage.current?.querySelector('.creator-avatar');
    if (blob && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      gsap.fromTo(
        blob,
        { scaleX: 1.3, scaleY: 0.7, y: 10 },
        { scaleX: 1, scaleY: 1, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.35)' },
      );
  }, [look]);
  return (
    <div className="blob-picker">
      <div className="avatar-mode" role="group" aria-label="Profile picture type">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={mode === 'blob'}
          onClick={() => onModeChange('blob')}
        >
          Be a blob
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={mode === 'photo'}
          onClick={() => onModeChange('photo')}
        >
          Use a photo
        </button>
      </div>
      {preview && (
        <div className="blob-mini-stage" ref={stage}>
          <Avatar
            key={mode === 'photo' ? photo.cover?.id : JSON.stringify(value)}
            profile={{ name: 'Your', blob: value, avatar: mode === 'photo' ? photo.cover : null }}
            size={150}
          />
        </div>
      )}
      {mode === 'blob' ? (
        <>
          <fieldset disabled={disabled} className="blob-shapes">
            <legend>Pick a little weirdo</legend>
            <div>
              {blobShapes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={s.label}
                  aria-pressed={value.shape === s.id}
                  onClick={() => change('shape', s.id)}
                >
                  <BlobFace value={{ ...value, shape: s.id }} size={58} />
                  <span>{s.label}</span>
                  {value.shape === s.id && <Check size={12} className="blob-selected" />}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={disabled} className="blob-swatches">
            <legend>A little colour</legend>
            <div>
              {blobColors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  aria-pressed={value.color === c.id}
                  style={{ '--swatch': c.hex }}
                  onClick={() => change('color', c.id)}
                >
                  <span />
                  {value.color === c.id && <Check size={17} style={{ color: c.eye }} />}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={disabled} className="blob-moods">
            <legend>Current energy</legend>
            <div>
              {blobMoods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={value.mood === m.id}
                  onClick={() => change('mood', m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            className="blob-shuffle"
            disabled={disabled}
            onClick={() =>
              onChange({
                shape: blobShapes[1 + Math.floor(Math.random() * (blobShapes.length - 1))].id,
                color: blobColors[Math.floor(Math.random() * blobColors.length)].id,
                mood: blobMoods[Math.floor(Math.random() * blobMoods.length)].id,
                seed: crypto.randomUUID(),
              })
            }
          >
            <Shuffle size={16} /> Surprise me
          </button>
          <span className="sr-only" aria-live="polite">
            {shape.label} selected.
          </span>
        </>
      ) : (
        <div className="blob-photo-option">
          <label className="button avatar-upload">
            <Upload size={16} />
            {photo.busy ? 'Preparing photo…' : 'Choose a photo'}
            <input
              aria-label="Profile photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled || photo.busy}
              onChange={(e) => {
                photo.upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <p>JPG, PNG or WebP. Up to 25 MB. We’ll resize it for you.</p>
          {photo.cover && (
            <button
              type="button"
              className="text-button"
              disabled={disabled || photo.busy}
              onClick={() => {
                photo.clear();
                onModeChange('blob');
              }}
            >
              Remove photo
            </button>
          )}
          {!photo.cover && <p>No photo yet? Your blob has you covered.</p>}
          {photo.error && (
            <p role="alert" className="form-error">
              {photo.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

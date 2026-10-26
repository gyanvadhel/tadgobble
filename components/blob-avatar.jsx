'use client';
import { useState } from 'react';
import { Blobatar } from '@blobatar/react';
import { happy, wink, sleepy, surprised } from 'blobatar/expression';
import { blobPath } from '../lib/mascot.mjs';
import { blobShapes, blobColors, defaultBlob } from '../lib/blob-options.mjs';
import '../app/blob-onboarding.css';

const expressions = { happy, wink, sleepy, wow: surprised };
function Original({ color, mood }) {
  return (
    <svg viewBox="0 0 100 90" aria-hidden="true">
      <path d={blobPath} fill={color.hex} />
      {[34, 61].map((x, i) => (
        <g key={x}>
          {mood === 'happy' || (mood === 'wink' && i === 1) ? (
            <path
              d={`M${x - 8} 43Q${x} 29 ${x + 8} 43`}
              stroke="#fffef6"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
            />
          ) : (
            <>
              <ellipse cx={x} cy="40" rx="10" ry={mood === 'sleepy' ? 7 : 15} fill="#fffef6" />
              <ellipse cx={x + 3} cy="42" rx="4" ry={mood === 'sleepy' ? 4 : 8} fill="#191a1c" />
            </>
          )}
        </g>
      ))}
      {mood === 'wow' ? (
        <ellipse cx="50" cy="65" rx="9" ry="10" fill="#191a1c" />
      ) : (
        <path
          d="M37 63Q50 75 65 61"
          stroke="#191a1c"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
export function BlobFace({ value = defaultBlob, size = 96, label, className = '' }) {
  const shape = blobShapes.find((x) => x.id === value?.shape) || blobShapes[0];
  const color = blobColors.find((x) => x.id === value?.color) || blobColors[0];
  return (
    <span
      className={`blob-face ${className}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {shape.id === 'gobble' ? (
        <Original color={color} mood={value?.mood} />
      ) : (
        <>
          <Blobatar
            name={`tadgobble-${value?.seed || 'gobble'}`}
            size={size}
            alt=""
            background={false}
            palette={{ head: color.hex, eye: color.eye }}
            expression={expressions[value?.mood]}
            traits={{
              shape: shape.trait,
              'eye.ratio': 0.45,
              'eye.rx': 1,
              'eye.scale': 0.7,
              'eye.gap': 0.9,
              'gaze.x': 0.5,
              'gaze.y': 0.15,
              'body.x': 0.5,
              'body.y': 0.5,
              'body.rot': 0.5,
            }}
          />
          <svg className="blob-smile" viewBox="0 0 100 100" aria-hidden="true">
            {value?.mood === 'wow' ? (
              <ellipse cx="50" cy="62" rx="3.5" ry="4.5" fill={color.eye} />
            ) : (
              <path
                d="M44 60Q50 66 56 60"
                stroke={color.eye}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            )}
          </svg>
        </>
      )}
    </span>
  );
}
export function Avatar({ profile, size = 96, className = '' }) {
  const [failed, setFailed] = useState('');
  const url = profile?.avatar?.url;
  return (
    <span className={`creator-avatar ${className}`} style={{ width: size, height: size }}>
      {url && failed !== url ? (
        <img
          src={url}
          alt={`${profile.name || 'Your'} profile photo`}
          onError={() => setFailed(url)}
        />
      ) : (
        <BlobFace
          value={profile?.blob || defaultBlob}
          size={size}
          label={`${profile?.name || 'Your'} Gobble avatar`}
        />
      )}
    </span>
  );
}

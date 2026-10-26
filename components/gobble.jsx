import { blobPath } from '../lib/mascot.mjs';

export function Gobble({ className = '', eyesOnly = false, hungry = false, ...props }) {
  return (
    <svg className={className} viewBox="0 0 100 90" fill="none" aria-hidden="true" {...props}>
      {!eyesOnly && <path d={blobPath} fill="currentColor" />}
      {[34, 61].map((x) => (
        <g className="gobble-eye" key={x}>
          <ellipse cx={x} cy="40" rx="10" ry="15" fill="#fffef6" />
          <ellipse className="gobble-pupil" cx={x + 3} cy="42" rx="4" ry="8" fill="#191a1c" />
        </g>
      ))}
      {!eyesOnly &&
        (hungry ? (
          <ellipse cx="50" cy="65" rx="12" ry="10" fill="#191a1c" />
        ) : (
          <path d="M37 63Q50 75 65 61" stroke="#191a1c" strokeWidth="4" strokeLinecap="round" />
        ))}
    </svg>
  );
}

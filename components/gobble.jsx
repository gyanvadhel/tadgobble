import { blobPath, expressions } from '../lib/mascot.mjs';

export function Gobble({ className = '', eyesOnly = false, hungry = false, expression, ...props }) {
  // `expression` wins over `hungry`; with neither, Gobble looks exactly as it always has.
  const mood = expressions[expression] || (hungry ? expressions.hungry : expressions.calm);
  const { d, ellipse } = mood.mouth;
  return (
    <svg className={className} viewBox="0 0 100 90" fill="none" aria-hidden="true" {...props}>
      {!eyesOnly && <path d={blobPath} fill="currentColor" />}
      {[34, 61].map((x, i) =>
        mood.closedEye === i ? (
          <path
            className="gobble-eye gobble-eye-shut"
            key={x}
            d={`M${x - 9} 42Q${x} 33 ${x + 9} 42`}
            stroke="#191a1c"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ) : (
          <g className="gobble-eye" key={x}>
            <ellipse cx={x} cy="40" rx="10" ry={15 * mood.eyeScaleY} fill="#fffef6" />
            <ellipse className="gobble-pupil" cx={x + 3} cy="42" rx="4" ry="8" fill="#191a1c" />
          </g>
        ),
      )}
      {!eyesOnly &&
        (ellipse ? (
          <ellipse {...ellipse} fill="#191a1c" />
        ) : (
          <path d={d} stroke="#191a1c" strokeWidth="4" strokeLinecap="round" />
        ))}
    </svg>
  );
}

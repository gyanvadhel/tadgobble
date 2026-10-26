'use client';
import { Check } from 'lucide-react';
import { starterIntents, starterInterests } from '../lib/blob-options.mjs';
export default function StarterPreferences({ value, onChange, disabled = false }) {
  return (
    <div className="starter-preferences">
      <fieldset disabled={disabled}>
        <legend>What brings you here?</legend>
        <div className="starter-intents">
          {starterIntents.map((i) => (
            <label key={i.id}>
              <input
                type="radio"
                name="starter-intent"
                value={i.id}
                checked={value.intent === i.id}
                onChange={() => onChange({ ...value, intent: i.id })}
              />
              <span>
                <strong>{i.label}</strong>
                <small>{i.note}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled} className="starter-interests">
        <legend>
          Your favourite rabbit holes <span>optional</span>
        </legend>
        <p>Pick up to six. You can always change these.</p>
        <div>
          {starterInterests.map((i) => {
            const selected = value.interests.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={selected}
                disabled={!selected && value.interests.length >= 6}
                onClick={() =>
                  onChange({
                    ...value,
                    interests: selected
                      ? value.interests.filter((x) => x !== i)
                      : [...value.interests, i],
                  })
                }
              >
                {selected && <Check size={14} />} {i}
              </button>
            );
          })}
        </div>
        <span className="starter-count" aria-live="polite">
          {value.interests.length} of 6 picked
        </span>
      </fieldset>
      <p className="starter-private">
        Just for your account. These answers aren’t on your public profile.
      </p>
    </div>
  );
}

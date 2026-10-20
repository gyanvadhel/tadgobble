'use client';
import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Plus,
  Search,
  Sparkles,
  Globe,
  Send,
  Pencil,
  LoaderCircle,
} from 'lucide-react';
import { Gobble } from './gobble';
import CoverEditor, { useProductCover } from './cover-editor';
import {
  categories,
  audiences,
  platforms,
  pricingModels,
  productColors,
} from '../lib/product-options.mjs';
import '../app/submission.css';
import { api } from '../lib/client-api.mjs';

const steps = ['The basics', 'Your people', 'The details', 'One last look'];
const titles = [
  'What did you make?',
  'Find your corner.',
  'Make it feel like you.',
  'Looking pretty tasty.',
];
const notes = [
  'A name. A link. A little “oh, I need that.”',
  'No niche gatekeeping. Just help the right people find you.',
  'A little context goes a long way. Everything here is optional.',
  'This goes to our review queue before it goes on the menu.',
];
const initial = {
  name: '',
  url: '',
  tagline: '',
  category: '',
  audience: 'Everyone',
  platforms: [],
  description: '',
  pricingModel: '',
  pricingDetail: '',
  facts: '',
  source: '',
  demoUrl: '',
  color: 'lilac',
  ownership: false,
};

function InputField({ label, hint, children }) {
  const id = useId();
  return (
    <div className="submission-field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export default function SubmitWizard({ onDone }) {
  const coverState = useProductCover();
  const capturedUrl = useRef('');
  const [data, setData] = useState(initial),
    [step, setStep] = useState(0),
    [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [submitted, setSubmitted] = useState(false);
  const form = useRef(null),
    heading = useRef(null),
    entered = useRef(false);
  const color = productColors.find((option) => option.value === data.color);
  const update = (key, value) => {
    if (key === 'url' && value !== data.url && coverState.cover?.kind !== 'upload') {
      coverState.clear();
      capturedUrl.current = '';
    }
    setData((previous) => ({ ...previous, [key]: value }));
    setError('');
  };
  const pricing =
    [data.pricingModel, data.pricingDetail.trim()].filter(Boolean).join(' · ') ||
    'See current pricing';
  const matched = categories.filter((category) =>
    category.toLowerCase().includes(query.trim().toLowerCase()),
  );
  function go(next) {
    setError('');
    setStep(next);
  }
  useEffect(() => {
    if (entered.current) heading.current?.focus({ preventScroll: true });
    entered.current = true;
    form.current?.closest('.modal')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [step, submitted]);

  async function next(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (step === 0) {
      if (!data.name.trim() || !data.tagline.trim()) {
        setError('Give it a name and a short description before continuing.');
        return;
      }
      try {
        if (!['http:', 'https:'].includes(new URL(data.url).protocol)) throw new Error();
      } catch {
        setError('Use a website link starting with https:// or http://.');
        return;
      }
      if (capturedUrl.current !== data.url && coverState.cover?.kind !== 'upload') {
        capturedUrl.current = data.url;
        void coverState.capture(data.url);
      }
    }
    if (step === 1 && !data.category) {
      setError('Pick the category that fits best. You only need one.');
      form.current?.querySelector('.category-choices button')?.focus();
      return;
    }
    if (step < 3) {
      go(step + 1);
      return;
    }
    if (!data.ownership) {
      setError('Confirm that you’re the maker or have permission to submit.');
      return;
    }
    if (coverState.busy) return;
    setBusy(true);
    try {
      await api('submit', { ...data, pricing, coverId: coverState.cover?.id || null });
      setSubmitted(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (submitted)
    return (
      <div className="submission-success">
        <Gobble />
        <span className="submission-receipt">
          <Check size={17} />
          In the review queue
        </span>
        <h2 ref={heading} tabIndex={-1}>
          You cooked.
          <br />
          We’ll take it from here.
        </h2>
        <p>
          <strong>{data.name}</strong> is ready for a human look. It will appear in discoveries
          after approval.
        </p>
        <button className="submission-primary" onClick={onDone}>
          Back to the good stuff <ArrowRight size={18} />
        </button>
      </div>
    );

  return (
    <div className="submission-workshop" data-step={step}>
      <div className="submission-top">
        <span>
          <Gobble />
          The launch kitchen
        </span>
        <span>From side project to “send me the link”.</span>
      </div>
      <nav className="submission-steps" aria-label="Submission progress">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            disabled={index > step}
            aria-current={step === index ? 'step' : undefined}
            onClick={() => go(index)}
          >
            <span>{index < step ? <Check size={13} /> : index + 1}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="submission-layout">
        <aside
          className="submission-preview"
          style={{ '--ticket-color': color.hex }}
          aria-label="Live product preview"
        >
          <div className="preview-intro">
            <Sparkles size={17} />
            Your next good find, taking shape.
          </div>
          <div className="maker-ticket">
            <div className={`ticket-art ${coverState.cover ? 'has-cover' : ''}`}>
              {coverState.cover ? (
                <img
                  className="ticket-cover"
                  src={coverState.cover.url}
                  alt={`${data.name || 'Your product'} website cover`}
                  width="1600"
                  height="1200"
                />
              ) : (
                <>
                  <span className="ticket-orbit" />
                  <span className="ticket-initial">
                    {data.name.trim().slice(0, 1).toUpperCase() || '?'}
                  </span>
                </>
              )}
              <span className="ticket-label">{data.category || 'a little bit of potential'}</span>
            </div>
            <div className="ticket-copy">
              <h3>{data.name.trim() || 'Your very good thing'}</h3>
              <p>{data.tagline.trim() || 'The thing someone wishes they knew about yesterday.'}</p>
              <div>
                <span>
                  {data.audience === 'Everyone'
                    ? 'For the curious'
                    : `For ${data.audience.toLowerCase()}`}
                </span>
                <ArrowUpRight size={20} />
              </div>
            </div>
            <span className="ticket-perforation" />
          </div>
          {coverState.busy && (
            <p className="ticket-capture-status" role="status">
              <LoaderCircle className="spin" size={14} /> Preparing your cover…
            </p>
          )}
          <div className="gobble-tip">
            <Gobble />
            <p>
              {
                [
                  '“already saving room for this.”',
                  '“there’s a person for every weird little thing.”',
                  '“tiny details. big personality.”',
                  '“one final nibble before we send it.”',
                ][step]
              }
            </p>
          </div>
          <span className="preview-disclaimer">
            A preview of your listing. Published after review.
          </span>
        </aside>
        <form ref={form} onSubmit={next} className="submission-form">
          <div className="submission-heading">
            <span>
              Step {step + 1} of {steps.length}
            </span>
            <h2 ref={heading} tabIndex={-1}>
              {titles[step]}
            </h2>
            <p>{notes[step]}</p>
          </div>
          <div key={step} className="submission-step-content">
            {step === 0 && (
              <>
                <InputField label="Product name">
                  {(id) => (
                    <input
                      id={id}
                      name="name"
                      value={data.name}
                      onChange={(e) => update('name', e.target.value)}
                      required
                      maxLength={60}
                      placeholder="The name on the tin"
                      autoComplete="off"
                    />
                  )}
                </InputField>
                <InputField
                  label="Product website"
                  hint="We’ll capture a preview after you continue. You can replace or skip it."
                >
                  {(id) => (
                    <div className="submission-url">
                      <Globe size={18} />
                      <input
                        id={id}
                        name="url"
                        type="url"
                        required
                        maxLength={1000}
                        placeholder="https://your-very-good-thing.com"
                        value={data.url}
                        onChange={(e) => update('url', e.target.value)}
                      />
                    </div>
                  )}
                </InputField>
                <InputField
                  label="One sentence that says it all"
                  hint={`${data.tagline.length}/100 · What does it help someone do?`}
                >
                  {(id) => (
                    <textarea
                      id={id}
                      name="tagline"
                      required
                      maxLength={100}
                      rows={2}
                      value={data.tagline}
                      onChange={(e) => update('tagline', e.target.value)}
                      placeholder="Turn messy voice notes into a plan you can actually follow."
                    />
                  )}
                </InputField>
              </>
            )}
            {step === 1 && (
              <>
                <fieldset className="submission-choice-field">
                  <legend>
                    Pick its main category <span>One good fit is enough.</span>
                  </legend>
                  <label className="category-search">
                    <Search size={16} />
                    <input
                      aria-label="Find a category"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find its corner of the internet…"
                    />
                  </label>
                  <div className="category-choices" role="group" aria-label="Product category">
                    {matched.map((category) => (
                      <button
                        type="button"
                        key={category}
                        aria-pressed={data.category === category}
                        onClick={() => update('category', category)}
                      >
                        {data.category === category ? <Check size={14} /> : <Plus size={14} />}
                        {category}
                      </button>
                    ))}
                  </div>
                  {!matched.length && (
                    <p className="category-no-results">
                      No category matches.{' '}
                      <button type="button" onClick={() => setQuery('')}>
                        Show all categories
                      </button>
                    </p>
                  )}
                  {data.category && (
                    <p className="category-selected">
                      On the menu under <strong>{data.category}</strong>.
                    </p>
                  )}
                </fieldset>
                <fieldset className="submission-choice-field">
                  <legend>Who’s it for?</legend>
                  <div className="audience-choices" role="group" aria-label="Product audience">
                    {audiences.map((audience) => (
                      <button
                        key={audience}
                        type="button"
                        aria-pressed={data.audience === audience}
                        onClick={() => update('audience', audience)}
                      >
                        {audience}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <details className="submission-optional">
                  <summary>
                    Where can people use it?{' '}
                    <span>
                      Optional <Plus size={15} />
                    </span>
                  </summary>
                  <div className="platform-choices" role="group" aria-label="Supported platforms">
                    {platforms.map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        aria-pressed={data.platforms.includes(platform)}
                        onClick={() =>
                          update(
                            'platforms',
                            data.platforms.includes(platform)
                              ? data.platforms.filter((item) => item !== platform)
                              : [...data.platforms, platform],
                          )
                        }
                      >
                        {platform}
                        {data.platforms.includes(platform) && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                </details>
              </>
            )}
            {step === 2 && (
              <>
                <CoverEditor state={coverState} website={data.url} name={data.name} />
                <fieldset className="submission-choice-field">
                  <legend>
                    How does pricing work?{' '}
                    <span>Skip if you’d rather point people to your site.</span>
                  </legend>
                  <div className="pricing-choices" role="group" aria-label="Pricing model">
                    {pricingModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        aria-pressed={data.pricingModel === model}
                        onClick={() =>
                          update('pricingModel', data.pricingModel === model ? '' : model)
                        }
                      >
                        {model}
                        {data.pricingModel === model && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <InputField label="Pricing details" hint="Optional. For example, “from $8/month”.">
                  {(id) => (
                    <input
                      id={id}
                      name="pricingDetail"
                      maxLength={60}
                      value={data.pricingDetail}
                      onChange={(e) => update('pricingDetail', e.target.value)}
                      placeholder="Anything useful to know?"
                    />
                  )}
                </InputField>
                <fieldset className="submission-choice-field color-choices">
                  <legend>Pick a color for your spot.</legend>
                  <div role="group" aria-label="Listing color">
                    {productColors.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        style={{ background: option.hex }}
                        aria-label={option.name}
                        aria-pressed={data.color === option.value}
                        onClick={() => update('color', option.value)}
                      >
                        {data.color === option.value && <Check size={19} />}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <details className="submission-optional">
                  <summary>
                    Add a little more context{' '}
                    <span>
                      Optional <Plus size={15} />
                    </span>
                  </summary>
                  <InputField label="Tell us about it">
                    {(id) => (
                      <textarea
                        id={id}
                        name="description"
                        maxLength={2000}
                        rows={3}
                        value={data.description}
                        onChange={(e) => update('description', e.target.value)}
                        placeholder="What makes it useful? What sparked the idea?"
                      />
                    )}
                  </InputField>
                  <InputField
                    label="Key capabilities"
                    hint="Up to five factual capabilities, one per line."
                  >
                    {(id) => (
                      <textarea
                        id={id}
                        name="facts"
                        maxLength={1500}
                        rows={3}
                        value={data.facts}
                        onChange={(e) => update('facts', e.target.value)}
                      />
                    )}
                  </InputField>
                  <InputField
                    label="Documentation or source link"
                    hint="We’ll use your product website if you leave this blank."
                  >
                    {(id) => (
                      <input
                        id={id}
                        type="url"
                        name="source"
                        maxLength={1000}
                        value={data.source}
                        onChange={(e) => update('source', e.target.value)}
                        placeholder="https://"
                      />
                    )}
                  </InputField>
                  <InputField label="Demo link" hint="A walkthrough or demo people can open.">
                    {(id) => (
                      <input
                        id={id}
                        type="url"
                        name="demoUrl"
                        maxLength={1000}
                        value={data.demoUrl}
                        onChange={(e) => update('demoUrl', e.target.value)}
                        placeholder="https://"
                      />
                    )}
                  </InputField>
                </details>
              </>
            )}
            {step === 3 && (
              <>
                <p className="submission-review-note">
                  {coverState.busy
                    ? 'Your cover is still being prepared.'
                    : coverState.cover
                      ? 'Your chosen cover will appear with the listing after review.'
                      : 'No cover selected. Your listing will use its name and color.'}{' '}
                  <button type="button" className="submission-back" onClick={() => go(2)}>
                    Edit cover
                  </button>
                </p>
                <div className="submission-review">
                  <div>
                    <span>The thing</span>
                    <button type="button" onClick={() => go(0)}>
                      Edit basics <Pencil size={13} />
                    </button>
                  </div>
                  <h3>{data.name}</h3>
                  <p>{data.tagline}</p>
                  <a href={data.url} target="_blank" rel="noreferrer">
                    {data.url} <ArrowUpRight size={14} />
                  </a>
                </div>
                <div className="submission-review">
                  <div>
                    <span>Its corner</span>
                    <button type="button" onClick={() => go(1)}>
                      Edit audience <Pencil size={13} />
                    </button>
                  </div>
                  <p>
                    {data.category} · {data.audience}
                  </p>
                  {data.platforms.length > 0 && <small>{data.platforms.join(', ')}</small>}
                </div>
                <div className="submission-review">
                  <div>
                    <span>The details</span>
                    <button type="button" onClick={() => go(2)}>
                      Edit details <Pencil size={13} />
                    </button>
                  </div>
                  <p>{pricing}</p>
                  {data.description && <small>{data.description}</small>}
                  {data.facts && (
                    <ul>
                      {data.facts
                        .split('\n')
                        .filter(Boolean)
                        .slice(0, 5)
                        .map((fact, index) => (
                          <li key={index}>{fact}</li>
                        ))}
                    </ul>
                  )}
                  {data.demoUrl && (
                    <a href={data.demoUrl} target="_blank" rel="noreferrer">
                      Open demo <ArrowUpRight size={13} />
                    </a>
                  )}
                </div>
                <label className="submission-ownership">
                  <input
                    type="checkbox"
                    checked={data.ownership}
                    required
                    onChange={(e) => update('ownership', e.target.checked)}
                  />
                  <span>I’m the maker or have permission to submit this product.</span>
                </label>
                <p className="submission-review-note">
                  A real person will review your listing. Sending it doesn’t publish it
                  automatically.
                </p>
              </>
            )}
          </div>
          {error && (
            <p className="submission-error" role="alert">
              {error}
            </p>
          )}
          <div className="submission-actions">
            {step > 0 ? (
              <button
                type="button"
                className="submission-back"
                disabled={busy}
                onClick={() => go(step - 1)}
              >
                <ArrowLeft size={16} />
                Back
              </button>
            ) : (
              <span>Good things start small.</span>
            )}
            <button
              className="submission-primary"
              disabled={busy || (step === 3 && coverState.busy)}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={17} />
                  Sending…
                </>
              ) : step === 3 ? (
                <>
                  {coverState.busy ? 'Preparing cover…' : 'Send for review'} <Send size={17} />
                </>
              ) : (
                <>
                  Continue <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

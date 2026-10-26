'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Globe, ImagePlus, LoaderCircle, Send } from 'lucide-react';
import { Gobble } from './gobble';
import CoverEditor, { useProductCover } from './cover-editor';
import {
  artCategories,
  appCategories,
  audiences,
  platforms,
  pricingModels,
} from '../lib/product-options.mjs';
import { api } from '../lib/client-api.mjs';
import '../app/submission.css';

const initial = {
  kind: 'art',
  name: '',
  url: '',
  tagline: '',
  category: 'Art & design',
  audience: 'Everyone',
  platforms: [],
  description: '',
  pricingModel: '',
  pricingDetail: '',
  facts: '',
  source: '',
  demoUrl: '',
  imageDescription: '',
  ownership: false,
};

function Field({ label, hint, children }) {
  const id = useId();
  return (
    <div className="share-field">
      <label htmlFor={id}>{label}</label>
      {children(id, hint ? `${id}-hint` : undefined)}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}

export default function SubmitWizard({ onDone, product = null, creator = null }) {
  const coverState = useProductCover(product?.cover || null);
  const [data, setData] = useState(() =>
    product
      ? {
          ...initial,
          ...product.submission,
          name: product.name,
          kind: product.submission?.kind || 'app',
          url: product.url,
          tagline: product.tagline,
          category: product.category,
          audience: product.audience,
          description: product.description,
          source: product.source,
          facts: product.facts.join('\n'),
          pricingDetail:
            product.submission?.pricingModel &&
            product.pricing.startsWith(product.submission.pricingModel)
              ? product.pricing
                  .slice(product.submission.pricingModel.length)
                  .replace(/^\s*·\s*/, '')
              : product.pricing,
          // They confirmed this when they first shared it.
          ownership: true,
        }
      : initial,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const errorRef = useRef(null),
    successRef = useRef(null),
    formRef = useRef(null);
  const art = data.kind === 'art';
  const update = (key, value) => {
    if (key === 'url' && coverState.cover?.kind === 'capture') coverState.clear();
    setData((old) => ({ ...old, [key]: value }));
    setError('');
  };
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (coverState.cover?.url) setError('');
  }, [coverState.cover?.id, coverState.cover?.url]);
  useEffect(() => {
    if (submitted) successRef.current?.focus();
  }, [submitted]);

  async function submit(event) {
    event.preventDefault();
    if (busy || coverState.busy) return;
    setError('');
    if (art && (!coverState.cover?.url || coverState.cover.kind !== 'upload')) {
      setError('Add a photo or video of your work first. Use “Add a photo” or “Add a video”.');
      return;
    }
    if (data.url.trim()) {
      try {
        if (!['http:', 'https:'].includes(new URL(data.url).protocol)) throw new Error();
      } catch {
        setError('Your link should start with https:// or http://.');
        return;
      }
    }
    setBusy(true);
    try {
      const common = {
        kind: data.kind,
        name: data.name,
        url: data.url.trim(),
        category: data.category,
        description: data.description,
        imageDescription: data.imageDescription,
        ownership: data.ownership,
        coverId: coverState.cover?.id || null,
        onBehalf: data.onBehalf === true,
        creatorName: data.creatorName || '',
        creatorInstagram: data.creatorInstagram || '',
        ...(product ? { id: product.id } : {}),
      };
      await api(
        product ? 'works/update' : 'submit',
        art
          ? common
          : {
              ...data,
              ...common,
              pricing: [data.pricingModel, data.pricingDetail.trim()].filter(Boolean).join(' · '),
            },
      );
      setSubmitted(true);
      formRef.current?.closest('.modal')?.scrollTo({ top: 0, behavior: 'instant' });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (submitted)
    return (
      <div className="share-success">
        <Gobble />
        <span className="share-receipt">
          <Check size={18} /> In the review queue
        </span>
        <h2 ref={successRef} tabIndex={-1}>
          {product ? (
            'Changes saved.'
          ) : (
            <>
              Look at you.
              <br />
              Putting it out there.
            </>
          )}
        </h2>
        <p>
          <strong>{data.name}</strong> is in for a human look.{' '}
          {product?.status === 'published'
            ? 'The current version stays live until your edits are approved.'
            : 'It will appear in discoveries after approval.'}
        </p>
        <a className="share-send" href="/my-work">
          Track it in My work <ArrowRight size={18} />
        </a>
        <button className="text-button" onClick={onDone}>
          Back to discoveries
        </button>
      </div>
    );

  const linkInput = (id, hint) => (
    <input
      id={id}
      aria-describedby={hint}
      name="url"
      type="url"
      value={data.url}
      onChange={(e) => update('url', e.target.value)}
      required={!art}
      placeholder="https://"
      autoComplete="url"
    />
  );

  return (
    <form
      ref={formRef}
      className="share-workspace"
      onSubmit={submit}
      aria-busy={busy}
      onInvalid={(event) => event.target.closest('details')?.setAttribute('open', '')}
    >
      <header className="share-heading">
        <span className="share-kicker">
          <Gobble /> {product ? 'Editing your post.' : 'A little courage. A good place to start.'}
        </span>
        {product ? (
          <>
            <h2>
              A few touch-ups?
              <br />
              <span>Make it just right.</span>
            </h2>
            <p>
              Fix a typo, add the story, or swap in a better shot. To share something different,
              start a new post.
            </p>
          </>
        ) : (
          <>
            <h2>
              Made something?
              <br />
              <span>Let it be seen.</span>
            </h2>
            <p>A painting. A side project. That thing you made at 2am. There’s room for it here.</p>
          </>
        )}
        {product?.status === 'published' && (
          <p className="review-edit-note">
            Your current version stays live while these edits are reviewed.
          </p>
        )}
        {creator && (
          <p className="share-credit-note">
            Your work is credited to <strong>{creator.name}</strong>.{' '}
            <a href="/settings">Edit your profile</a>
          </p>
        )}
      </header>
      {/* The kind is fixed once posted: edits are touch-ups, not a different post. */}
      {!product && (
        <fieldset className="share-kinds" disabled={busy || coverState.busy}>
          <legend>What are you sharing?</legend>
          {[
            ['art', 'Art & design', ImagePlus],
            ['app', 'App or tool', Globe],
          ].map(([value, label, Icon]) => (
            <label key={value} className={data.kind === value ? 'chosen' : ''}>
              <input
                type="radio"
                name="kind"
                value={value}
                checked={data.kind === value}
                onChange={() => {
                  if (value === 'art' && coverState.cover?.kind === 'capture') coverState.clear();
                  setData((old) => ({
                    ...old,
                    kind: value,
                    category: value === 'art' ? 'Art & design' : 'Design',
                  }));
                  setError('');
                }}
              />
              <Icon size={19} aria-hidden="true" />
              {label}
              <Check className="kind-check" size={16} aria-hidden="true" />
            </label>
          ))}
        </fieldset>
      )}
      <div className="share-layout">
        <div className="share-image-panel">
          <CoverEditor
            state={coverState}
            website={data.url}
            name={data.name || 'Your work'}
            artwork={art}
            allowVideo
            removable={!(product && art)}
          />
          <div className="share-image-note">
            <Gobble />
            <span>
              {art
                ? 'No portfolio? No problem. This is your little spot on the wall.'
                : 'Big launch or little experiment. Both belong here.'}
            </span>
          </div>
        </div>
        <div className="share-writing">
          <Field
            label={art ? 'Give it a title' : 'App or tool name'}
            hint={art ? '“Sunday sketch” is a perfectly good title.' : undefined}
          >
            {(id, hint) => (
              <input
                id={id}
                aria-describedby={hint}
                name="name"
                value={data.name}
                onChange={(e) => update('name', e.target.value)}
                required
                maxLength={60}
                placeholder={art ? 'What do you call it?' : 'The name on the tin'}
              />
            )}
          </Field>
          {!art && (
            <>
              <Field label="Website link">{linkInput}</Field>
              <Field label="What does it do?">
                {(id) => (
                  <input
                    id={id}
                    name="tagline"
                    value={data.tagline}
                    onChange={(e) => update('tagline', e.target.value)}
                    required
                    maxLength={100}
                    placeholder="One simple sentence"
                  />
                )}
              </Field>
            </>
          )}
          <details className="share-extras">
            <summary>
              More details <span>optional</span>
              <ChevronDown size={18} />
            </summary>
            <div className="share-extra-fields">
              <label className="share-permission">
                <input
                  type="checkbox"
                  checked={data.onBehalf === true}
                  onChange={(e) => update('onBehalf', e.target.checked)}
                />
                <span>I’m sharing someone else’s work with permission.</span>
              </label>
              {data.onBehalf && (
                <>
                  <Field
                    label="Creator’s name"
                    hint="Credit the person who made it. This won’t appear as your own portfolio work."
                  >
                    {(id, hint) => (
                      <input
                        id={id}
                        aria-describedby={hint}
                        value={data.creatorName || ''}
                        onChange={(e) => update('creatorName', e.target.value)}
                        required
                        maxLength={60}
                      />
                    )}
                  </Field>
                  <Field label="Creator’s Instagram (optional)">
                    {(id) => (
                      <input
                        id={id}
                        value={data.creatorInstagram || ''}
                        onChange={(e) => update('creatorInstagram', e.target.value)}
                        placeholder="@theirname"
                        maxLength={31}
                        autoCapitalize="none"
                      />
                    )}
                  </Field>
                </>
              )}
              <Field
                label={art ? 'A little about it' : 'Tell us more'}
                hint="The story, your process, or what you’d like feedback on."
              >
                {(id, hint) => (
                  <textarea
                    id={id}
                    aria-describedby={hint}
                    name="description"
                    value={data.description}
                    onChange={(e) => update('description', e.target.value)}
                    maxLength={2000}
                    rows={3}
                  />
                )}
              </Field>
              <Field label="Category">
                {(id) => (
                  <select
                    id={id}
                    name="category"
                    value={data.category}
                    onChange={(e) => update('category', e.target.value)}
                  >
                    {(art ? artCategories : appCategories).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field
                label="Describe the image"
                hint="Help someone using a screen reader picture your work."
              >
                {(id, hint) => (
                  <textarea
                    id={id}
                    aria-describedby={hint}
                    name="imageDescription"
                    value={data.imageDescription}
                    onChange={(e) => update('imageDescription', e.target.value)}
                    maxLength={400}
                    rows={2}
                    placeholder="For example: a blue watercolour of a quiet street after rain"
                  />
                )}
              </Field>
              {art ? (
                <Field
                  label="A link, if you have one"
                  hint="Your Instagram, portfolio, or project page. It’s fine to leave this empty."
                >
                  {linkInput}
                </Field>
              ) : (
                <>
                  <Field label="Who is it for?">
                    {(id) => (
                      <select
                        id={id}
                        value={data.audience}
                        onChange={(e) => update('audience', e.target.value)}
                      >
                        {audiences.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <fieldset className="share-platforms">
                    <legend>Available on</legend>
                    {platforms.map((p) => (
                      <label key={p}>
                        <input
                          type="checkbox"
                          checked={data.platforms.includes(p)}
                          onChange={(e) =>
                            update(
                              'platforms',
                              e.target.checked
                                ? [...data.platforms, p]
                                : data.platforms.filter((v) => v !== p),
                            )
                          }
                        />
                        {p}
                      </label>
                    ))}
                  </fieldset>
                  <Field label="Pricing">
                    {(id) => (
                      <select
                        id={id}
                        value={data.pricingModel}
                        onChange={(e) => update('pricingModel', e.target.value)}
                      >
                        <option value="">Not specified</option>
                        {pricingModels.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="Pricing details">
                    {(id) => (
                      <input
                        id={id}
                        value={data.pricingDetail}
                        onChange={(e) => update('pricingDetail', e.target.value)}
                        maxLength={65}
                        placeholder="For example: free for personal use"
                      />
                    )}
                  </Field>
                  <Field label="Key capabilities" hint="One factual capability per line.">
                    {(id, hint) => (
                      <textarea
                        id={id}
                        aria-describedby={hint}
                        value={data.facts}
                        onChange={(e) => update('facts', e.target.value)}
                        maxLength={1500}
                        rows={3}
                      />
                    )}
                  </Field>
                  <Field label="Source for those details">
                    {(id) => (
                      <input
                        id={id}
                        type="url"
                        value={data.source}
                        onChange={(e) => update('source', e.target.value)}
                        placeholder="https://"
                      />
                    )}
                  </Field>
                  <Field label="Demo video link">
                    {(id) => (
                      <input
                        id={id}
                        type="url"
                        value={data.demoUrl}
                        onChange={(e) => update('demoUrl', e.target.value)}
                        placeholder="https://"
                      />
                    )}
                  </Field>
                </>
              )}
            </div>
          </details>
          <label className="share-permission">
            <input
              type="checkbox"
              checked={data.ownership}
              onChange={(e) => update('ownership', e.target.checked)}
              required
            />
            <span>This is my work, or I have permission to share it.</span>
          </label>
          {error && (
            <p ref={errorRef} tabIndex={-1} className="share-error" role="alert">
              {error}
            </p>
          )}
          <button className="share-send" disabled={busy || coverState.busy}>
            {busy ? (
              <>
                <LoaderCircle size={18} className="spin" /> Sending…
              </>
            ) : coverState.busy ? (
              'Preparing image…'
            ) : (
              <>
                Send for review <Send size={18} />
              </>
            )}
          </button>
          <p className="share-review-note">
            Free to share. Reviewed by a human before it goes public.
          </p>
        </div>
      </div>
    </form>
  );
}

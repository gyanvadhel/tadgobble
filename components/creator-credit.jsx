'use client';
import { useEffect, useState } from 'react';
import { Download, Link2, Share2 } from 'lucide-react';
import { profileCard, workCard } from './story-card';
export function CreatorCredit({ product, prefix = 'by ' }) {
  const name = product.owner_name || 'a creator';
  if (product.creator_username)
    return (
      <a
        className="creator-credit"
        href={`/profile/${encodeURIComponent(product.creator_username)}`}
      >
        {prefix}
        {name}
      </a>
    );
  if (product.creator_instagram)
    return (
      <a
        className="creator-credit"
        href={`https://www.instagram.com/${encodeURIComponent(product.creator_instagram)}/`}
        target="_blank"
        rel="noreferrer"
      >
        {prefix}
        {name}
      </a>
    );
  return (
    <span>
      {prefix}
      {name}
    </span>
  );
}
const formats = [
  { id: 'story', label: 'Story', note: '9:16' },
  { id: 'post', label: 'Post', note: '4:5' },
];
const draw = (product, profile, format) =>
  product
    ? workCard(product, location.origin, format)
    : profileCard(profile, location.origin, format);

// Besides sharing the link, a work or profile can be shared as a ready-made
// image in two sizes: a 9:16 story and a 4:5 feed post, so Instagram never crops
// it in half. On phones that can share files the images go to the share sheet;
// they are drawn ahead of the tap because phones only open the sheet straight
// after one. Elsewhere the buttons download the image instead.
// Instagram drops links on shared images, so the link goes to the clipboard.
export function ShareButton({ path, title, label = 'Share', product, profile }) {
  const [message, setMessage] = useState(''),
    [files, setFiles] = useState({}),
    [canFiles, setCanFiles] = useState(false),
    [busy, setBusy] = useState('');
  const subject = product || profile;
  useEffect(() => {
    if (!subject) return;
    const phone = !!navigator.canShare && matchMedia('(pointer: coarse)').matches;
    if (!phone) return;
    let live = true;
    Promise.all(formats.map((f) => draw(product, profile, f.id)))
      .then((drawn) => {
        if (!live || !navigator.canShare({ files: [drawn[0]] })) return;
        setFiles({ story: drawn[0], post: drawn[1] });
        setCanFiles(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // Saving or commenting hands over a new object; only redraw when the picture changes.
  }, [
    subject?.id || subject?.username,
    subject?.cover?.url || subject?.avatar?.url,
    subject?.name,
    subject?.color,
  ]); // eslint-disable-line react-hooks/exhaustive-deps
  const url = () => new URL(path, location.origin).href;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setMessage('Link copied.');
    } catch {
      setMessage(url());
    }
  }
  async function shareImage(format) {
    setMessage('');
    try {
      if (canFiles && files[format]) {
        navigator.clipboard?.writeText(url()).catch(() => {});
        await navigator.share({ files: [files[format]], title });
        setMessage(
          format === 'story'
            ? 'Link copied. Paste it into a link sticker on your story.'
            : 'Link copied. Paste it in your caption or bio.',
        );
        return;
      }
      setBusy(format);
      const file = await draw(product, profile, format);
      const href = URL.createObjectURL(file);
      Object.assign(document.createElement('a'), { href, download: file.name }).click();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      setMessage(
        format === 'story'
          ? 'Saved. Post it as an Instagram story and add a link sticker.'
          : 'Saved. Post it on Instagram; it fits the feed without cropping.',
      );
    } catch (e) {
      if (e.name !== 'AbortError') setMessage('Couldn’t make the image. The link still works: ' + url());
    } finally {
      setBusy('');
    }
  }
  return (
    <span className="share-control">
      <button
        type="button"
        className="button"
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title, url: url() });
            else await copy();
          } catch (e) {
            if (e.name !== 'AbortError') setMessage(url());
          }
        }}
      >
        <Share2 size={16} />
        {label}
      </button>
      {subject && (
        <span className="share-formats" role="group" aria-label="Image for Instagram">
          <span>Image for Instagram</span>
          {formats.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`share-format share-format-${f.id}`}
              onClick={() => shareImage(f.id)}
              disabled={!!busy}
              title={`${f.label} (${f.note})`}
            >
              <i aria-hidden="true" />
              {busy === f.id ? 'Drawing…' : f.label}
              {!canFiles && <Download size={13} aria-hidden="true" />}
            </button>
          ))}
        </span>
      )}
      {subject && canFiles && (
        <button type="button" className="share-link-only" onClick={copy}>
          <Link2 size={14} /> Just copy the link
        </button>
      )}
      {message && <small role="status">{message}</small>}
    </span>
  );
}

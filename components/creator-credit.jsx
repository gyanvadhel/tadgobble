'use client';
import { useEffect, useState } from 'react';
import { Link2, Share2 } from 'lucide-react';
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
// On phones that can share files, the share button hands over a ready-made 4:5
// image of the work or profile. 4:5 is the tallest shape the Instagram feed shows
// without cropping, and Stories show it whole on a backdrop, so one image works
// for both. It is drawn ahead of the tap because phones only open the share
// sheet straight after one. Instagram drops links on shared images, so the link
// goes to the clipboard. Everywhere else the button shares or copies the link.
export function ShareButton({ path, title, label = 'Share', product, profile }) {
  const [message, setMessage] = useState(''),
    [image, setImage] = useState(null);
  const subject = product || profile;
  useEffect(() => {
    if (!subject || !navigator.canShare || !matchMedia('(pointer: coarse)').matches) return;
    let live = true;
    (product
      ? workCard(product, location.origin, 'post')
      : profileCard(profile, location.origin, 'post')
    )
      .then((file) => live && navigator.canShare({ files: [file] }) && setImage(file))
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
  return (
    <span className="share-control">
      <button
        type="button"
        className="button"
        onClick={async () => {
          setMessage('');
          try {
            if (image) {
              navigator.clipboard?.writeText(url()).catch(() => {});
              await navigator.share({ files: [image], title });
              setMessage('Link copied. Paste it in your caption or a story link sticker.');
            } else if (navigator.share) await navigator.share({ title, url: url() });
            else await copy();
          } catch (e) {
            if (e.name !== 'AbortError') setMessage(url());
          }
        }}
      >
        <Share2 size={16} />
        {label}
      </button>
      {image && (
        <button type="button" className="share-link-only" onClick={copy}>
          <Link2 size={14} /> Just copy the link
        </button>
      )}
      {message && <small role="status">{message}</small>}
    </span>
  );
}

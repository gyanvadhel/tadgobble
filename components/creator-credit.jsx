'use client';
import { useEffect, useState } from 'react';
import { Link2, Share2 } from 'lucide-react';
import { storyCard } from './story-card';
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
// On phones that can share files, a work's share button hands over a story-sized
// image so Instagram (and other apps) can post it as a story. The image is drawn
// ahead of the tap because phones only open the share sheet straight after one.
// Instagram drops links on shared images, so the link goes to the clipboard.
export function ShareButton({ path, title, label = 'Share', product }) {
  const [message, setMessage] = useState(''),
    [story, setStory] = useState(null);
  useEffect(() => {
    if (!product || !navigator.canShare || !matchMedia('(pointer: coarse)').matches) return;
    let live = true;
    storyCard(product, location.origin)
      .then((file) => live && navigator.canShare({ files: [file] }) && setStory(file))
      .catch(() => {});
    return () => {
      live = false;
    };
    // Saving or commenting hands over a new object; only redraw when the picture changes.
  }, [product?.id, product?.cover?.url, product?.name]); // eslint-disable-line react-hooks/exhaustive-deps
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
          try {
            if (story) {
              navigator.clipboard?.writeText(url()).catch(() => {});
              await navigator.share({ files: [story], title });
              setMessage('Link copied. Paste it into a link sticker on your story.');
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
      {story && (
        <button type="button" className="share-link-only" onClick={copy}>
          <Link2 size={14} /> Just copy the link
        </button>
      )}
      {message && <small role="status">{message}</small>}
    </span>
  );
}

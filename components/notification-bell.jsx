'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api, cloudMode } from '../lib/client-api.mjs';
import { notificationText, timeAgo } from '../lib/notifications.mjs';
import '../app/notifications.css';

// The bell in the header: what happened to your work. Only on the hosted site, and only when signed in.
export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const root = useRef(null);
  const button = useRef(null);

  const load = useCallback(async () => {
    try {
      const { supabase } = await import('../lib/cloud-api.mjs');
      const { data } = await supabase().auth.getSession();
      if (!data?.session) return setReady(false);
      const result = await api('notifications');
      setItems(result.items || []);
      setUnread(result.unread || 0);
      setReady(true);
    } catch {
      // A bell that cannot load stays quiet rather than getting in the way of the page.
    }
  }, []);

  useEffect(() => {
    if (!cloudMode) return;
    load();
    const visible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const away = (e) => !root.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  if (!cloudMode || !ready) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      api('notifications/read').catch(() => setUnread((n) => n || 1));
    }
  }

  return (
    <div
      className="bell"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="bell-button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className="bell-badge" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          {items.length ? (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <a className={item.read ? '' : 'is-new'} href={`/product/${item.product.slug}`}>
                    <span>{notificationText(item)}</span>
                    <time dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bell-empty">
              Nothing yet. Post something and Gobble will tell you when people notice.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

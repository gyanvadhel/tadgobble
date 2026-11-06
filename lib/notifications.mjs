// What a bell item says, and how old it is. Used by the bell in the header.

export function notificationText(item) {
  const name = item.product?.name || 'your work';
  const who = item.actor?.name || 'Someone';
  switch (item.kind) {
    case 'save':
      return item.count > 1 ? `${item.count} people saved ${name}` : `Someone saved ${name}`;
    case 'comment':
      return `${who} commented on ${name}: "${item.preview || ''}"`;
    case 'reply':
      return `${who} replied to your comment on ${name}`;
    case 'review':
      if (item.outcome === 'approved') return `${name} is live again`;
      if (item.outcome === 'changes') return `${name} needs a small change`;
      return `${name} was taken down`;
    default:
      return name;
  }
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function timeAgo(iso, now = Date.now()) {
  const then = new Date(iso);
  const seconds = Math.max(0, Math.floor((now - then.getTime()) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
  return `${then.getDate()} ${months[then.getMonth()]}`;
}

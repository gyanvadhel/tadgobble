import { AppError, textField, webUrl } from './auth.mjs';
export const profileColors = ['lavender', 'butter', 'pond', 'peach'];
const reserved = new Set([
  'admin',
  'studio',
  'support',
  'tadgobble',
  'gobble',
  'settings',
  'account',
  'discover',
  'profile',
]);
export function profileFields(body) {
  const username = String(body.username || '')
    .trim()
    .toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,39}$/.test(username) || reserved.has(username))
    throw new AppError(
      'Choose a username of 3–40 letters, numbers or underscores, starting with a letter.',
    );
  const instagram = instagramHandle(body.instagram);
  return {
    name: textField(body.name, 'Display name', 60),
    username,
    bio: textField(body.bio || '', 'Bio', 300, 0),
    specialty: textField(body.specialty || '', 'What you make', 80, 0),
    instagram,
    website: body.website ? webUrl(body.website, 'Website') : '',
    color: profileColors.includes(body.color) ? body.color : 'lavender',
    visible: body.visible !== false,
  };
}
export function instagramHandle(value) {
  const handle = String(value || '')
    .trim()
    .replace(/^@/, '');
  if (handle && !/^[a-zA-Z0-9._]{1,30}$/.test(handle))
    throw new AppError('Enter an Instagram username, without the website address.');
  return handle;
}
export function creditFields(body) {
  return {
    onBehalf: body.onBehalf === true,
    creatorName: body.onBehalf === true ? textField(body.creatorName, 'Creator name', 60) : '',
    creatorInstagram: body.onBehalf === true ? instagramHandle(body.creatorInstagram) : '',
  };
}

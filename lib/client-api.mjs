export const cloudMode = process.env.NEXT_PUBLIC_DEPLOYMENT_TARGET === 'firebase';

export async function api(path, body, options = {}) {
  if (cloudMode) {
    const { cloudApi } = await import('./cloud-api.mjs');
    return cloudApi(path, body, options);
  }
  const response = await fetch('/api/' + path, {
    ...options,
    ...(body === undefined
      ? { cache: 'no-store' }
      : body instanceof FormData
        ? { method: 'POST', body }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

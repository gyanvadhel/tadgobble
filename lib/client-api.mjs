export const cloudMode = process.env.NEXT_PUBLIC_DEPLOYMENT_TARGET === 'firebase';

export async function api(path, body, options = {}) {
  if (path === 'videos/upload' && body instanceof FormData) {
    const { prepareVideo } = await import('./prepare-video.mjs');
    body = await prepareVideo(body.get('file'), options.signal, options.onProgress);
  }
  if (cloudMode) {
    const { cloudApi } = await import('./cloud-api.mjs');
    return cloudApi(path, body, options);
  }
  if (path === 'covers/upload' && body instanceof FormData) {
    const { prepareImage } = await import('./prepare-image.mjs');
    const resized = await prepareImage(body.get('file'), options.signal);
    body = new FormData();
    body.set('file', resized, 'image.webp');
  }
  const { onProgress, ...requestOptions } = options;
  const response = await fetch('/api/' + path, {
    ...requestOptions,
    ...(body === undefined
      ? { cache: 'no-store' }
      : body instanceof FormData
        ? { method: 'POST', body }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

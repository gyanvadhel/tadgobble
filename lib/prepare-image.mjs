// Keep originals on the device; only a bounded, resized image leaves the browser.
export async function prepareImage(file, signal) {
  if (!file || file.size > 25 * 1024 * 1024)
    throw new Error('Choose an image under 25 MB. We’ll resize it for you.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error(
      'Choose a JPG, PNG or WebP photo. For HEIC photos, export a JPG from your Photos app.',
    );
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image could not be opened. Try another JPG, PNG or WebP photo.');
  }
  try {
    if (bitmap.width < 160 || bitmap.height < 120 || bitmap.width * bitmap.height > 60_000_000)
      throw new Error('Use an image at least 160 × 120 pixels and below 60 megapixels.');
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const scale = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error(
        'Your browser could not prepare the image. Try opening this page in Safari or Chrome.',
      );
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (!blob || blob.size > 5 * 1024 * 1024)
      throw new Error('We couldn’t resize this image. Try another photo.');
    return blob;
  } finally {
    bitmap.close();
  }
}

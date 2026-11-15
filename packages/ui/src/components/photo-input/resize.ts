/**
 * Shrinks a photograph in the browser before it is uploaded, so a phone's 4 to 12 MB camera picture
 * leaves as a JPEG of a few hundred kilobytes and the upload finishes on 3G (ADR 0037). The longest edge
 * becomes at most `maxEdge` pixels, the picture is turned upright from its EXIF orientation, and it is
 * encoded as JPEG at `quality`. A picture already small enough and already a JPEG is sent as it is.
 *
 * It never refuses: where the browser cannot decode or draw the picture (an old browser, a format it does
 * not know), the original file is returned and the server's own type and size checks decide.
 */
export interface ResizeOptions {
  /** The longest edge, in pixels. 1600 keeps a carcass or an ear tag readable. */
  maxEdge?: number;
  /** JPEG quality between 0 and 1. */
  quality?: number;
}

export const DEFAULT_MAX_EDGE = 1600;
export const DEFAULT_QUALITY = 0.8;
const JPEG = 'image/jpeg';

/** The size that fits `width` by `height` inside a square of `maxEdge`, keeping the shape, in whole pixels. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = width >= height ? width : height;
  if (longest <= maxEdge) return { width, height };
  // Whole pixels by integer division, never below one.
  const scale = (side: number) => {
    const scaled = (side * maxEdge - ((side * maxEdge) % longest)) / longest;
    return scaled < 1 ? 1 : scaled;
  };
  return { width: scale(width), height: scale(height) };
}

/** The file name the resized picture is sent under: the original's, ending in .jpg. */
export function jpegName(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem === '' ? 'photo' : stem}.jpg`;
}

export async function resizePhoto(file: File, options: ResizeOptions = {}): Promise<File> {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  try {
    const size = fitWithin(bitmap.width, bitmap.height, maxEdge);
    if (size.width === bitmap.width && size.height === bitmap.height && file.type === JPEG) {
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (context === null) return file;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, JPEG, quality));
    if (blob === null || blob.size >= file.size) return file;
    return new File([blob], jpegName(file.name), { type: JPEG, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

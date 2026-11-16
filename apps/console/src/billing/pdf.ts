/**
 * The bytes of a PDF the API sent inline as base64 (`ReprintResult.pdfBase64`), as a Blob the browser can
 * show and save. Only bytes are decoded: nothing is read from or added to the document.
 */
export function pdfBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
}

/** A short-lived object URL for the Blob, or null where the browser has none (a test's DOM). */
export function objectUrl(blob: Blob): string | null {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : null;
}

export function releaseUrl(url: string | null): void {
  if (url !== null && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
}

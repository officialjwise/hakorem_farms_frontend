/** Where to go after sign-in. Only an in-app path is allowed, so a crafted `next` cannot send a user elsewhere. */
export function safeNext(value: string | null): string {
  if (value === null || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return '/';
  return value;
}

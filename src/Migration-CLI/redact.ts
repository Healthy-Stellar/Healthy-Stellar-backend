/** Strips credentials from any postgres connection string found in a message. */
export function redactConnectionStrings(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/[^\s"'`]*/gi, 'postgresql://[REDACTED]');
}

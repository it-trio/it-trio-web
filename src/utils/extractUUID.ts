export default function extractUUID(url: string): string | null {
  // Regular expression for UUID v4
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
  const match = url.match(uuidRegex);

  return match ? match[0] : null;
}

/** Normaliza UID lido pelo ACR122U (hex sem espaços, maiúsculas). */
export function normalizeRfidUid(uid) {
  return String(uid || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

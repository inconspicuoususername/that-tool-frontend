export const AUTH_TOKEN_COOKIE = "thattool_jwt";

export function getTokenFromSearchParams(searchParams: {
  token?: string | string[];
}) {
  const token = searchParams.token;
  if (!token) return null;
  return Array.isArray(token) ? token[0] ?? null : token;
}

const AUTH_BASE = "https://ep-icy-shape-au5tb70w.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth";
const DATA_API_BASE = "https://ep-icy-shape-au5tb70w.apirest.c-10.us-east-1.aws.neon.tech/neondb/rest/v1";

type TokenPayload = Record<string, unknown> | null;
let cachedToken: { value: string; expiresAt: number } | null = null;

function tokenFromJson(body: TokenPayload): string | null {
  if (!body) return null;
  const data = body.data as Record<string, unknown> | undefined;
  const candidates = [body.token, body.access_token, body.accessToken, data?.token, data?.access_token, data?.accessToken];
  return candidates.find((value): value is string => typeof value === "string" && value.split(".").length === 3) ?? null;
}

function jwtExpiry(token: string): number {
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : Date.now() + 10 * 60_000;
  } catch {
    return Date.now() + 10 * 60_000;
  }
}

export async function getAnonymousJwt(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 30_000) return cachedToken.value;

  const response = await fetch(`${AUTH_BASE}/token/anonymous`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await response.text();
  let body: TokenPayload = null;
  try {
    body = text ? (JSON.parse(text) as TokenPayload) : null;
  } catch {
    body = null;
  }

  const headerToken = response.headers.get("set-auth-jwt") ?? response.headers.get("x-auth-jwt");
  const token = (headerToken && headerToken.split(".").length === 3 ? headerToken : null) ?? tokenFromJson(body);

  if (!response.ok || !token) {
    throw new Error(`Unable to obtain Neon anonymous JWT (${response.status}): ${text.slice(0, 500) || "no token returned"}`);
  }

  cachedToken = { value: token, expiresAt: jwtExpiry(token) };
  return token;
}

export async function callVerificationRpc(name: string, payload: Record<string, unknown>) {
  const jwt = await getAnonymousJwt();
  return fetch(`${DATA_API_BASE}/rpc/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

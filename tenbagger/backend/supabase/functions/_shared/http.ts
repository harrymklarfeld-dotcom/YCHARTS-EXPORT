// HTTP helpers: JSON responses, CORS, typed errors, body parsing with size limits.

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export const badRequest = (msg: string, code = "invalid_request") => new HttpError(400, code, msg);

export function corsHeaders(req: Request, allowedOrigins: string[]): Record<string, string> {
  const origin = req.headers.get("origin");
  const h: Record<string, string> = {
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    vary: "Origin",
  };
  if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
    h["access-control-allow-origin"] = origin;
  }
  return h;
}

export function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
}

/** Read the raw body with a hard size cap (default 16 KiB). */
export async function readBody(req: Request, maxBytes = 16 * 1024): Promise<string> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new HttpError(413, "payload_too_large", "request body too large");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HttpError(413, "payload_too_large", "request body too large");
  }
  return text;
}

export async function readJsonObject(req: Request, maxBytes = 16 * 1024): Promise<Record<string, unknown>> {
  if (req.method === "GET") return {};
  const text = await readBody(req, maxBytes);
  if (!text.trim()) return {};
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw badRequest("body must be JSON");
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw badRequest("body must be a JSON object");
  return v as Record<string, unknown>;
}

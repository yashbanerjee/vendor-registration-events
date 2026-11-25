import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const hopByHop = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length", "content-encoding"]);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const base = process.env.API_PROXY_URL ?? "http://localhost:3001";
  const target = `${base.replace(/\/$/, "")}/api/v1/${path.map((segment) => encodeURIComponent(segment)).join("/")}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  for (const name of hopByHop) headers.delete(name);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    // Stream the body when possible so large document uploads are not re-buffered here.
    const init: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      redirect: "manual",
      cache: "no-store",
    };
    if (hasBody) {
      if (request.body) {
        init.body = request.body;
        init.duplex = "half";
      } else {
        init.body = await request.arrayBuffer();
      }
    }
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json({ error: { message: "The API is not running." } }, { status: 502 });
  }
  const outgoing = new Headers();
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (name === "set-cookie" || hopByHop.has(name)) return;
    outgoing.set(key, value);
  });
  const response = new NextResponse(upstream.body, { status: upstream.status, headers: outgoing });
  const cookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

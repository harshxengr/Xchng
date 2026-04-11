import { auth } from "@/lib/auth";
import { isOperatorSession } from "@/lib/auth-session";
import { env } from "@workspace/env";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    slug: string[];
  }>;
};

type JsonBody = Record<string, unknown>;
type OpenOrderSummary = {
  orderId: string;
};

const UPSTREAM_API_BASE_URL = env.NEXT_PUBLIC_API_URL;
const PUBLIC_GET_PATHS = new Set(["depth", "trades", "ticker", "tickers", "klines"]);
const SESSION_BOUND_GET_PATHS = new Set(["balances", "order/open", "order/history", "mm-bot/status"]);
const SESSION_BOUND_MUTATION_PATHS = new Set(["order", "deposit", "mm-bot/control"]);
const OPERATOR_ONLY_PATHS = new Set(["mm-bot/status", "mm-bot/control"]);

function createUpstreamUrl(path: string) {
  return new URL(path, UPSTREAM_API_BASE_URL.endsWith("/") ? UPSTREAM_API_BASE_URL : `${UPSTREAM_API_BASE_URL}/`);
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

async function getSession(request: NextRequest) {
  return auth.api.getSession({
    headers: request.headers,
  });
}

async function readJsonBody(request: NextRequest): Promise<JsonBody> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as JsonBody) : {};
  } catch {
    return {};
  }
}

async function toResponse(upstreamResponse: Response) {
  const text = await upstreamResponse.text();

  if (!text) {
    return new NextResponse(null, { status: upstreamResponse.status });
  }

  try {
    return NextResponse.json(JSON.parse(text), { status: upstreamResponse.status });
  } catch {
    return new NextResponse(text, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": upstreamResponse.headers.get("Content-Type") ?? "text/plain; charset=utf-8",
      },
    });
  }
}

async function proxyRequest(url: URL, init: RequestInit) {
  const upstreamResponse = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  return toResponse(upstreamResponse);
}

function ensureOperatorAccess(path: string, session: Awaited<ReturnType<typeof getSession>>) {
  if (!OPERATOR_ONLY_PATHS.has(path)) {
    return null;
  }

  if (!isOperatorSession(session)) {
    return jsonError("Operator access required", 403);
  }

  return null;
}

async function resolvePath(context: RouteContext) {
  const { slug } = await context.params;
  return slug.join("/");
}

async function verifyOrderOwnership(userId: string, market: string, orderId: string) {
  const ownershipUrl = createUpstreamUrl("order/open");
  ownershipUrl.searchParams.set("market", market);
  ownershipUrl.searchParams.set("userId", userId);

  const response = await fetch(ownershipUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to verify order ownership");
  }

  const orders = (await response.json()) as OpenOrderSummary[];
  return orders.some((order) => order.orderId === orderId);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const path = await resolvePath(context);
  const upstreamUrl = createUpstreamUrl(path);
  const searchParams = new URLSearchParams(request.nextUrl.searchParams);

  if (!PUBLIC_GET_PATHS.has(path)) {
    const session = await getSession(request);

    if (!session) {
      return jsonError("Authentication required", 401);
    }

    const operatorError = ensureOperatorAccess(path, session);
    if (operatorError) {
      return operatorError;
    }

    if (SESSION_BOUND_GET_PATHS.has(path)) {
      searchParams.set("userId", session.user.id);
    }
  }

  upstreamUrl.search = searchParams.toString();
  return proxyRequest(upstreamUrl, { method: "GET" });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const path = await resolvePath(context);

  if (!SESSION_BOUND_MUTATION_PATHS.has(path)) {
    return jsonError("Unsupported trading route", 404);
  }

  const session = await getSession(request);

  if (!session) {
    return jsonError("Authentication required", 401);
  }

  const operatorError = ensureOperatorAccess(path, session);
  if (operatorError) {
    return operatorError;
  }

  const body = await readJsonBody(request);
  body.userId = session.user.id;

  return proxyRequest(createUpstreamUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const path = await resolvePath(context);

  if (path !== "order") {
    return jsonError("Unsupported trading route", 404);
  }

  const session = await getSession(request);

  if (!session) {
    return jsonError("Authentication required", 401);
  }

  const body = await readJsonBody(request);
  const market = typeof body.market === "string" ? body.market : null;
  const orderId = typeof body.orderId === "string" ? body.orderId : null;

  if (!market || !orderId) {
    return jsonError("Invalid order cancellation payload", 400);
  }

  try {
    const ownsOrder = await verifyOrderOwnership(session.user.id, market, orderId);

    if (!ownsOrder) {
      return jsonError("Order not found for the current user", 404);
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to verify order ownership", 502);
  }

  return proxyRequest(createUpstreamUrl(path), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ market, orderId, userId: session.user.id }),
  });
}

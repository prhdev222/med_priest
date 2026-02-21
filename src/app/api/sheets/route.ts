import { NextRequest, NextResponse } from "next/server";

const SCRIPT_URL = process.env.SCRIPT_URL;

/* ─── In-memory cache ─── */
interface CacheEntry {
  text: string;
  status: number;
  ts: number;
}
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

function getCached(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function putCache(key: string, text: string, status: number) {
  cache.set(key, { text, status, ts: Date.now() });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

function invalidateAll() {
  cache.clear();
}

function missingConfig() {
  return NextResponse.json(
    { error: "ยังไม่ได้ตั้งค่า SCRIPT_URL ใน .env.local" },
    { status: 500 },
  );
}

export async function GET(req: NextRequest) {
  if (!SCRIPT_URL) return missingConfig();
  const url = new URL(SCRIPT_URL);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
  const cacheKey = url.searchParams.toString();
  const action = req.nextUrl.searchParams.get("action");
  const skipCache = action === "procedureStats" || action === "ipdByWard";

  const cached = skipCache ? null : getCached(cacheKey);
  if (cached) {
    return new NextResponse(cached.text, {
      status: cached.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Cache": "HIT",
      },
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await response.text();
    const isHtml = text.trim().startsWith("<!") || text.includes("<!DOCTYPE");
    if (isHtml && !response.ok) {
      return NextResponse.json(
        { error: "Backend ตอบกลับเป็นหน้า 404 — กรุณาตรวจสอบ SCRIPT_URL ใน .env.local ชี้ไปที่ Cloudflare Worker ที่ deploy แล้ว" },
        { status: 502 },
      );
    }
    if (!skipCache) putCache(cacheKey, text, response.status);
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    const msg = (error as Error).name === "AbortError"
      ? "Backend ตอบช้าเกินไป กรุณาลองใหม่"
      : `เรียก Backend ไม่สำเร็จ: ${(error as Error).message}`;
    return NextResponse.json({ error: msg }, { status: 504 });
  }
}

export async function POST(req: NextRequest) {
  if (!SCRIPT_URL) return missingConfig();

  try {
    const body = await req.json();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await response.text();
    invalidateAll();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    const msg = (error as Error).name === "AbortError"
      ? "Backend ตอบช้าเกินไป กรุณาลองใหม่"
      : `ส่งข้อมูลไม่สำเร็จ: ${(error as Error).message}`;
    return NextResponse.json({ error: msg }, { status: 504 });
  }
}

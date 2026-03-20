import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const AVWX_TOKEN = process.env.AVWX_TOKEN || "";

async function fetchAvwx(endpoint: string) {
  const res = await fetch(`https://avwx.rest/api/${endpoint}`, {
    headers: { Authorization: `TOKEN ${AVWX_TOKEN}` },
    next: { revalidate: 300 }, // cache 5 min
  });
  if (!res.ok) throw new Error(`AVWX ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const icaos = searchParams.get("icaos")?.split(",").filter(Boolean) || [];

  if (icaos.length === 0) {
    return NextResponse.json({ error: "No ICAO codes provided" }, { status: 400 });
  }

  const results: Record<string, { metar: string | null; taf: string | null; raw_metar: string | null; raw_taf: string | null; station: string; error?: string }> = {};

  await Promise.all(
    icaos.map(async (icao) => {
      const code = icao.trim().toUpperCase();
      try {
        const [metar, taf] = await Promise.all([
          fetchAvwx(`metar/${code}?options=info`).catch(() => null),
          fetchAvwx(`taf/${code}?options=info`).catch(() => null),
        ]);

        results[code] = {
          station: code,
          metar: metar?.sanitized || metar?.raw || null,
          raw_metar: metar?.raw || null,
          taf: taf?.sanitized || taf?.raw || null,
          raw_taf: taf?.raw || null,
        };
      } catch (e) {
        results[code] = {
          station: code,
          metar: null,
          taf: null,
          raw_metar: null,
          raw_taf: null,
          error: e instanceof Error ? e.message : "Unknown error",
        };
      }
    })
  );

  return NextResponse.json(results);
}

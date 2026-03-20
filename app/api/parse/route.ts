import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("pdf") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Dynamic import to avoid issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    
    const text = data.text;
    const totalChars = text.length;
    
    // Split into chunks of ~3000 chars with overlap
    const chunkSize = 3000;
    const overlap = 300;
    const chunks: { id: number; text: string; start: number }[] = [];
    
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push({
        id: chunks.length,
        text: text.slice(i, i + chunkSize),
        start: i,
      });
      if (i + chunkSize >= text.length) break;
    }

    // Extract a rough table of contents (lines that look like chapter titles)
    const lines = text.split("\n").filter((l: string) => l.trim().length > 0);
    const toc: string[] = [];
    for (const line of lines.slice(0, 200)) {
      const trimmed = line.trim();
      if (
        trimmed.length > 5 && trimmed.length < 80 &&
        (trimmed.match(/^\d+[\.\-\s]/) || trimmed.match(/^[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][^.!?,]{4,60}$/) || trimmed.match(/^CHAPITRE|^MODULE|^PARTIE|^SECTION/i))
      ) {
        toc.push(trimmed);
      }
    }

    return NextResponse.json({
      filename: file.name,
      pages: data.numpages,
      totalChars,
      chunkCount: chunks.length,
      chunks: chunks.slice(0, 20), // Send first 20 chunks for demo
      toc: Array.from(new Set(toc)).slice(0, 30),
      preview: text.slice(0, 500),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}

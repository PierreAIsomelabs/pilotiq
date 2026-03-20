const MAX_CHARS = 50_000;
const MIN_CHARS_THRESHOLD = 500;

export interface PdfExtractResult {
  text: string;
  pages: number;
  scanned: boolean;
}

export async function extractPdfText(file: File): Promise<PdfExtractResult> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = pdf.numPages;

  let text = "";
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    text += pageText + "\n";
    if (text.length >= MAX_CHARS) break;
  }

  const extractedText = text.trim();

  if (extractedText.length < MIN_CHARS_THRESHOLD) {
    return {
      text: "",
      pages,
      scanned: true,
    };
  }

  return { text: extractedText.slice(0, MAX_CHARS), pages, scanned: false };
}

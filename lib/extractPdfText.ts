const MAX_CHARS = 50_000;

export async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
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

  return { text: text.slice(0, MAX_CHARS), pages };
}

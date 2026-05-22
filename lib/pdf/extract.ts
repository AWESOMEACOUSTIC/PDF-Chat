import "server-only";

// Use PDF.js legacy build in Node
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // dynamic import keeps it server-side
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // No web worker in Node
  pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  let text = "";

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((it: any) => (typeof it.str === "string" ? it.str : ""))
        .join(" ") + "\n\n";
  }

  return text.trim();
}

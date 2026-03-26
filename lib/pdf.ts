// Polyfill browser globals needed by pdfjs-dist in Node.js
// Only text extraction is used — no actual rendering, so stubs are fine
if (typeof globalThis.DOMMatrix === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.DOMMatrix = class DOMMatrix { constructor() {} } as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.ImageData = class ImageData { constructor() {} } as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.Path2D = class Path2D { constructor() {} } as any;
}

// Pre-load the PDF worker to bypass Turbopack's dynamic import issue.
// pdfjs-dist checks globalThis.pdfjsWorker?.WorkerMessageHandler before
// attempting dynamic import(workerSrc) — setting it here skips that entirely.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsWorker = require("pdfjs-dist/legacy/build/pdf.worker.mjs");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).pdfjsWorker = pdfjsWorker;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pages.push(content.items.map((item: any) => item.str).join(" "));
  }
  return pages.join("\n");
}

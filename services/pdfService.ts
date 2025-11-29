
/**
 * Web Worker code to handle PDF processing off the main thread.
 * Using OffscreenCanvas for rendering if available.
 */
const workerCode = `
self.onmessage = async (e) => {
  const { pdfData, maxDimension, quality } = e.data;

  try {
    // 0. Environment Polyfills for Web Worker
    // PDF.js checks for window and document. In a worker, these might be missing.
    if (typeof window === 'undefined') {
        self.window = self;
    }
    if (typeof document === 'undefined') {
        // Mock document to satisfy library checks
        self.document = {
            currentScript: null,
            createElement: (tagName) => {
                if (tagName === 'canvas') {
                    return new OffscreenCanvas(1, 1);
                }
                return { 
                    getContext: () => {}, 
                    style: {},
                    setAttribute: () => {} 
                };
            },
            getElementsByTagName: () => [],
            head: { appendChild: () => {} },
            body: { appendChild: () => {} },
            documentElement: { style: {} }
        };
    }
    if (typeof HTMLCanvasElement === 'undefined') {
        // Some checks use instanceof HTMLCanvasElement
        self.HTMLCanvasElement = OffscreenCanvas;
    }

    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error("このブラウザはOffscreenCanvasをサポートしていません。");
    }

    // 1. Dynamic Import to ensure polyfills are active before library loads
    const pdfjsModule = await import('https://esm.sh/pdfjs-dist@4.0.379');
    const pdfJs = pdfjsModule.default || pdfjsModule;

    // 2. Configuration
    // Explicitly set workerSrc. Even with disableWorker: true, validation might occur.
    pdfJs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

    // 3. Configure loading task
    const loadingTask = pdfJs.getDocument({ 
      data: pdfData,
      disableWorker: true, // Process in the current thread (Worker thread)
      cMapUrl: 'https://esm.sh/pdfjs-dist@4.0.379/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://esm.sh/pdfjs-dist@4.0.379/standard_fonts/' 
    });

    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;
    const results = [];

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdfDocument.getPage(i);
      
      // 4. Calculate Scale
      let scale = 2.0; // Base scale
      const viewportRaw = page.getViewport({ scale: 1.0 });
      const maxSide = Math.max(viewportRaw.width, viewportRaw.height);
      
      // Limit max dimension to save memory
      if (maxSide * scale > maxDimension) {
        scale = maxDimension / maxSide;
      }

      const viewport = page.getViewport({ scale });

      // 5. Render to OffscreenCanvas
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // 6. Convert to Blob
      const blob = await canvas.convertToBlob({ 
        type: 'image/jpeg', 
        quality: quality 
      });

      results.push(blob);
    }

    // Send back all blobs
    self.postMessage({ success: true, blobs: results });

  } catch (error) {
    // Robust error serialization
    let errorMessage = "Unknown error in PDF Worker";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = "Non-serializable error occurred";
      }
    }
    
    if (!errorMessage || errorMessage === "{}") {
      errorMessage = "An undefined error occurred during PDF processing.";
    }

    self.postMessage({ success: false, error: errorMessage });
  }
};
`;

/**
 * Converts a PDF file into an array of image Files (one per page) using a Web Worker.
 * @param file The PDF file to convert
 * @returns Promise<File[]> Array of image files (JPEG)
 */
export const convertPdfToImages = async (file: File): Promise<File[]> => {
  const arrayBuffer = await file.arrayBuffer();

  return new Promise((resolve, reject) => {
    // Create Worker from Blob
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl, { type: "module" });

    worker.onmessage = (e) => {
      URL.revokeObjectURL(workerUrl); // Cleanup worker URL
      worker.terminate(); // Terminate worker

      if (e.data && e.data.success) {
        const blobs = e.data.blobs as Blob[];
        const files = blobs.map((b, i) => {
          const imageName = `${file.name.replace('.pdf', '')}_page_${i + 1}.jpg`;
          return new File([b], imageName, { type: 'image/jpeg' });
        });
        resolve(files);
      } else {
        const errorMsg = e.data?.error || "Unknown worker error (no data)";
        reject(new Error(errorMsg));
      }
    };

    worker.onerror = (e) => {
      URL.revokeObjectURL(workerUrl);
      worker.terminate();
      reject(new Error(`Worker System Error: ${e.message}`));
    };

    // Send data to worker
    worker.postMessage({ 
      pdfData: arrayBuffer,
      maxDimension: 2500,
      quality: 0.8 
    }, [arrayBuffer]); // Transfer the ArrayBuffer
  });
};

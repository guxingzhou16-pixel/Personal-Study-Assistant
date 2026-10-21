import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { errorMessage } from '../../lib/desktop';

GlobalWorkerOptions.workerSrc = workerUrl;
const assetRoot = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.href).href;

export function PdfPage({ data, page, zoom }: { data: Uint8Array; page: number; zoom: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(650);
  const [size, setSize] = useState({ width: 595, height: 842, scale: 1 });
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(true);
  useEffect(() => {
    const element = outer.current!;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(200, Math.floor(entries[0].contentRect.width - 40))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let alive = true;
    const task = getDocument({
      data: new Uint8Array(data),
      cMapUrl: `${assetRoot}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assetRoot}standard_fonts/`,
      wasmUrl: `${assetRoot}wasm/`,
      useWorkerFetch: false,
      enableXfa: false,
      stopAtErrors: true,
      verbosity: 0,
    });
    void task.promise
      .then((document) => {
        if (alive) setPdf(document);
      })
      .catch((reason) => {
        if (alive) setError(`PDF 无法打开：${errorMessage(reason)}`);
      });
    return () => {
      alive = false;
      void task.destroy();
    };
  }, [data]);
  useEffect(() => {
    if (!pdf || !canvas.current || !layer.current) return;
    let cancelled = false;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    let textLayer: TextLayer | undefined;
    const target = canvas.current;
    const textTarget = layer.current;
    setError('');
    setRendering(true);
    textTarget.replaceChildren();
    void (async () => {
      const pdfPage = await pdf.getPage(page);
      if (cancelled) return;
      const original = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min((width / original.width) * zoom, 4);
      const viewport = pdfPage.getViewport({ scale });
      // Bound bitmap allocation for high DPI displays and unusually large pages.
      const outputScale = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(16_000_000 / (viewport.width * viewport.height)),
      );
      target.width = Math.floor(viewport.width * outputScale);
      target.height = Math.floor(viewport.height * outputScale);
      setSize({ width: viewport.width, height: viewport.height, scale });
      const context = target.getContext('2d');
      if (!context) throw new Error('无法创建 PDF 画布。');
      render = pdfPage.render({
        canvas: target,
        canvasContext: context,
        viewport,
        transform: [outputScale, 0, 0, outputScale, 0, 0],
      });
      await render.promise;
      if (cancelled) return;
      textLayer = new TextLayer({
        textContentSource: await pdfPage.getTextContent(),
        container: textTarget,
        viewport,
      });
      await textLayer.render();
      if (!cancelled) setRendering(false);
    })().catch((reason) => {
      if (!cancelled) {
        setRendering(false);
        setError(`这一页未能显示：${errorMessage(reason)}`);
      }
    });
    return () => {
      cancelled = true;
      render?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, page, zoom, width]);
  return (
    <div className="pdf-viewport" ref={outer}>
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      {rendering && !error && (
        <p className="pdf-loading" role="status">
          正在铺开第 {page} 页…
        </p>
      )}
      <div
        className="pdf-page"
        style={
          {
            width: size.width,
            height: size.height,
            '--total-scale-factor': size.scale,
          } as React.CSSProperties
        }
      >
        <canvas
          ref={canvas}
          style={{ width: size.width, height: size.height }}
          aria-label={`PDF 第 ${page} 页原始版式`}
        />
        <div ref={layer} className="textLayer" data-testid="pdf-text-layer" />
      </div>
    </div>
  );
}

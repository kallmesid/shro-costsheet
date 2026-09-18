import { useState, useRef, useEffect } from 'react';
import { LineItem } from '../types.ts';

// Declare pdfjsLib for global script or dynamic import
declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export function usePdfLineItemImporter(
  onImportSuccess: (items: LineItem[], metadata?: any) => void,
  onError: (errorMsg: string) => void
) {
  const [parsingPdf, setParsingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // Dynamically load pdfjs from cdnjs or window if not loaded
  const ensurePdfJs = async (): Promise<any> => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      return window.pdfjsLib;
    }

    return new Promise((resolve, reject) => {
      // Check if script element already exists
      const existingScript = document.getElementById('pdfjs-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
          } else {
            reject(new Error('pdfjsLib not available after script load'));
          }
        });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load pdf.js script')));
        return;
      }

      const script = document.createElement('script');
      script.id = 'pdfjs-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('pdfjsLib not found on window after loading'));
        }
      };
      script.onerror = () => reject(new Error('PDF reader failed to load — check your connection and try again'));
      document.head.appendChild(script);
    });
  };

  /**
   * Exact client-side MVP parser from Shro Cost Sheet quotation PDF importer.
   * 100% local, no AI, no external API calls, pure PDF layout geometry.
   */
  const importLineItemsFromPDF = async (file: File) => {
    if (!file) return;
    setParsingPdf(true);

    try {
      const pdfjs = await ensurePdfJs();
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const parsedRows: any[] = [];
      let stopped = false;

      for (let pageNum = 1; pageNum <= doc.numPages && !stopped; pageNum++) {
        const page = await doc.getPage(pageNum);
        const content = await page.getTextContent();
        const items = content.items
          .map((it: any) => ({
            str: it.str || '',
            x: it.transform ? it.transform[4] : 0,
            x1: (it.transform ? it.transform[4] : 0) + (it.width || 0),
            y: it.transform ? it.transform[5] : 0,
          }))
          .filter((it: any) => it.str.trim() !== '');

        items.sort((a: any, b: any) => b.y - a.y || a.x - b.x);

        // Group items into per-line-item row blocks: a new row starts at a
        // bare integer ("1", "2", "3"...) sitting in the Sr No column, and
        // ends right before the next such marker or the totals footer. Once
        // the footer is hit, later pages (e.g. an attached annexure with an
        // unrelated table) are never touched.
        let currentRow: { firstLineY: number; srItem: any; items: any[] } | null = null;
        for (const it of items) {
          const trimmed = it.str.trim();
          const inSrCol = it.x >= 5 && it.x <= 40;
          const isFooterLabel = /^(Purchase Total|Margin Total|Grand Total)$/i.test(trimmed);
          if (isFooterLabel) {
            if (currentRow) {
              parsedRows.push(currentRow);
              currentRow = null;
            }
            stopped = true;
            break;
          }
          if (inSrCol && /^\d{1,3}\.?$/.test(trimmed)) {
            if (currentRow) parsedRows.push(currentRow);
            currentRow = { firstLineY: it.y, srItem: it, items: [] };
          }
          if (currentRow) currentRow.items.push(it);
        }
        if (currentRow && !stopped) parsedRows.push(currentRow);
      }

      const num = (s: any) => parseFloat(String(s || '').replace(/[₹$,\s]/g, '')) || 0;
      const extractedLineItems: LineItem[] = [];
      let skipped = 0;

      parsedRows.forEach((row) => {
        const firstLine = row.items.filter((it: any) => Math.abs(it.y - row.firstLineY) < 0.5);
        const firstLineSorted = firstLine.slice().sort((a: any, b: any) => a.x - b.x).filter((it: any) => it !== row.srItem);
        if (!firstLineSorted.length) {
          skipped++;
          return;
        }
        const descAnchorX = firstLineSorted[0].x;

        // Description: every fragment (any line) whose left edge matches the
        // anchor — left-aligned text keeps the same x0 across wrapped lines.
        // Bare "." bullet artifacts occupy this same slot but aren't real
        // text, so they're excluded from the joined string but still kept
        // out of the numeric clustering below.
        const descPositionalItems = row.items.filter(
          (it: any) => it !== row.srItem && Math.abs(it.x - descAnchorX) < 3
        );
        const desc = descPositionalItems
          .filter((it: any) => it.str.trim() !== '.')
          .map((it: any) => it.str.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Everything else is a right-aligned numeric column. Cluster by
        // shared right edge (x1) to reconstruct values that wrapped across
        // lines; cluster order left-to-right recovers column order.
        const others = row.items.filter((it: any) => it !== row.srItem && !descPositionalItems.includes(it));
        others.sort((a: any, b: any) => a.x1 - b.x1);
        const clusters: { x1: number; parts: any[] }[] = [];
        others.forEach((it: any) => {
          const last = clusters[clusters.length - 1];
          if (last && Math.abs(it.x1 - last.x1) < 5) {
            last.parts.push(it);
            last.x1 = it.x1;
          } else {
            clusters.push({ x1: it.x1, parts: [it] });
          }
        });

        if (clusters.length < 3) {
          skipped++;
          return; // need at least Purchase Price, Qty, Total
        }

        const clusterText = (c: any) =>
          c.parts.slice().sort((a: any, b: any) => b.y - a.y).map((it: any) => it.str.trim()).join(' ');
        const up = num(clusterText(clusters[0]));
        const qty = num(clusterText(clusters[1])) || 1;
        const total = num(clusterText(clusters[clusters.length - 1]));

        if (!desc && !up && !total) {
          skipped++;
          return;
        }

        const us = qty > 0 ? total / qty : total;
        const tp = up * qty;
        const ts = total;
        const margin = ts > 0 ? ((ts - tp) / ts) * 100 : 0;

        extractedLineItems.push({
          description: desc || '-',
          unit_purchase: parseFloat(up.toFixed(2)),
          unit_sale: parseFloat(us.toFixed(2)),
          quantity: qty,
          total_purchase: parseFloat(tp.toFixed(2)),
          total_sale: parseFloat(ts.toFixed(2)),
          margin_percentage: parseFloat(margin.toFixed(2)),
          margin_value: parseFloat((ts - tp).toFixed(2)),
          sub_total: parseFloat(ts.toFixed(2)),
          total: parseFloat(ts.toFixed(2)),
        });
      });

      if (extractedLineItems.length > 0) {
        onImportSuccess(extractedLineItems);
      } else {
        onError('No line items recognized — this importer only reads our standard Cost Sheet quotation PDF layout');
      }
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      onError(err.message || 'Could not read the PDF file');
    } finally {
      setParsingPdf(false);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
    }
  };

  return {
    parsingPdf,
    pdfInputRef,
    importLineItemsFromPDF,
  };
}

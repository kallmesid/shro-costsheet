export interface ParsedLineItem {
  sr_no?: number;
  category?: string;
  description: string;
  unit_purchase: number;
  unit_sale: number;
  quantity: number;
  uom?: string;
  total_purchase: number;
  total_sale: number;
  sub_total?: number;
  margin_percentage: number;
  margin_value?: number;
  cgst_rate?: number;
  cgst_amount?: number;
  sgst_rate?: number;
  sgst_amount?: number;
  tax_description?: string;
  tax_amount?: number;
  total?: number;
}

export interface ParsedCostSheetData {
  cs_number?: string;
  quotation_date?: string;
  valid_until?: string;
  customer_name?: string;
  customer_address?: string;
  subject?: string;
  oem?: string;
  distributor?: string;
  business_unit?: string;
  prepared_by_name?: string;
  prepared_by_phone?: string;
  prepared_by_email?: string;
  terms_and_conditions?: string;
  payment_terms?: string;
  purchase_total?: number;
  margin_total?: number;
  tax_total?: number;
  grand_total?: number;
  items: ParsedLineItem[];
}

/**
 * Exact port of MVP PDF line item importer from reference implementation.
 * 100% on-device / local parser without any AI, external APIs, or cloud services.
 * Extracts line items based on exact positional clustering:
 * - Description: left-aligned text fragments
 * - Purchase, Qty, Total: right-aligned numeric clusters
 * - Unit sale price derived per line as Total / Qty
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedLineItem[]> {
  const result = await parseCostSheetFromPdf(buffer);
  return result.items;
}

export async function parseCostSheetFromPdf(buffer: Buffer): Promise<ParsedCostSheetData> {
  const num = (s: any) => parseFloat(String(s || '').replace(/[₹$,\s]/g, '')) || 0;

  try {
    // Dynamically import pdfjs-dist legacy build for Node.js
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;

    const parsedRows: any[] = [];
    let stopped = false;

    for (let pageNum = 1; pageNum <= doc.numPages && !stopped; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const items = (content.items as any[])
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

    const lineItems: ParsedLineItem[] = [];
    let itemIndex = 1;

    parsedRows.forEach((row) => {
      const firstLine = row.items.filter((it: any) => Math.abs(it.y - row.firstLineY) < 0.5);
      const firstLineSorted = firstLine.slice().sort((a: any, b: any) => a.x - b.x).filter((it: any) => it !== row.srItem);
      if (!firstLineSorted.length) return;
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

      if (clusters.length < 3) return; // need at least Purchase Price, Qty, Total
      const clusterText = (c: any) =>
        c.parts.slice().sort((a: any, b: any) => b.y - a.y).map((it: any) => it.str.trim()).join(' ');
      
      let up = 0, qty = 1, uom = 'Box', margin_pct = 0, margin_val = 0, us = 0, sub_tot = 0, tax_desc = '', total = 0;

      if (clusters.length >= 9) {
        up = num(clusterText(clusters[0]));
        qty = num(clusterText(clusters[1])) || 1;
        uom = clusterText(clusters[2]) || 'Box';
        margin_pct = num(clusterText(clusters[3]));
        margin_val = num(clusterText(clusters[4]));
        us = num(clusterText(clusters[5]));
        sub_tot = num(clusterText(clusters[6]));
        tax_desc = clusterText(clusters[7]);
        total = num(clusterText(clusters[clusters.length - 1]));
      } else if (clusters.length >= 3) {
        up = num(clusterText(clusters[0]));
        qty = num(clusterText(clusters[1])) || 1;
        total = num(clusterText(clusters[clusters.length - 1]));
        us = qty > 0 ? total / qty : total;
        sub_tot = total;
      } else {
        return;
      }

      if (!desc && !up && !total) return;
      const tp = up * qty;
      const ts = sub_tot > 0 ? sub_tot : (us * qty);
      const margin = ts > 0 ? ((ts - tp) / ts) * 100 : margin_pct;
      const mVal = margin_val !== 0 ? margin_val : (ts - tp);
      const finalUs = qty > 0 ? ts / qty : us;

      // Extract ONLY tax percentages from PDF
      const combinedTaxSearchText = `${tax_desc} ${row.items.map((it: any) => it.str || '').join(' ')}`;
      let cgstRate = 0;
      let sgstRate = 0;

      const cgstMatch = combinedTaxSearchText.match(/CGST\s*[@:]?\s*(\d+(?:\.\d+)?)%/i);
      const sgstMatch = combinedTaxSearchText.match(/SGST\s*[@:]?\s*(\d+(?:\.\d+)?)%/i);
      if (cgstMatch) cgstRate = parseFloat(cgstMatch[1]);
      if (sgstMatch) sgstRate = parseFloat(sgstMatch[1]);

      if (cgstRate > 0 && sgstRate === 0) {
        sgstRate = cgstRate;
      } else if (sgstRate > 0 && cgstRate === 0) {
        cgstRate = sgstRate;
      } else if (cgstRate === 0 && sgstRate === 0) {
        const genMatch = combinedTaxSearchText.match(/(\d+(?:\.\d+)?)%/);
        if (genMatch) {
          const totRate = parseFloat(genMatch[1]);
          cgstRate = parseFloat((totRate / 2).toFixed(2));
          sgstRate = parseFloat((totRate / 2).toFixed(2));
        }
      }

      // Calculate the actual tax amounts and total dynamically based on fetched percentage
      const cgstAmt = parseFloat((ts * (cgstRate / 100)).toFixed(2));
      const sgstAmt = parseFloat((ts * (sgstRate / 100)).toFixed(2));
      const finalTot = parseFloat((ts + cgstAmt + sgstAmt).toFixed(2));

      lineItems.push({
        sr_no: itemIndex++,
        description: desc || '-',
        unit_purchase: parseFloat(up.toFixed(2)),
        unit_sale: parseFloat(finalUs.toFixed(2)),
        quantity: qty,
        uom: uom || 'Box',
        total_purchase: parseFloat(tp.toFixed(2)),
        total_sale: parseFloat(ts.toFixed(2)),
        margin_percentage: parseFloat(margin.toFixed(2)),
        margin_value: parseFloat(mVal.toFixed(2)),
        sub_total: parseFloat(ts.toFixed(2)),
        cgst_rate: cgstRate,
        cgst_amount: cgstAmt,
        sgst_rate: sgstRate,
        sgst_amount: sgstAmt,
        tax_description: `CGST @${cgstRate}%: ${cgstAmt.toFixed(2)} | SGST @${sgstRate}%: ${sgstAmt.toFixed(2)}`,
        total: finalTot,
      });
    });

    return {
      items: lineItems,
    };
  } catch (err) {
    console.error('PDF parsing error in parseCostSheetFromPdf:', err);
    return { items: [] };
  }
}

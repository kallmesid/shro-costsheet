import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CostSheet } from '../types.ts';
import { STAGE_SHORT_NAMES } from './constants.ts';

export function generateCostSheetPDF(sheet: CostSheet) {
  // Create landscape orientation PDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 55, 'F');

  // Company Name & Title
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('SHRO SYSTEMS', 30, 26);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Est. 1988 • Digital Transformation Specialists • Sales Quotation & Profitability Sheet', 30, 42);

  // Status Badge in Top Right
  const statusColor = sheet.status === 'Approved' ? [22, 163, 74] : sheet.status === 'Rejected' ? [220, 38, 38] : [217, 119, 6];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(pageWidth - 140, 16, 110, 24, 4, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(sheet.status.toUpperCase(), pageWidth - 85, 32, { align: 'center' });

  // Metadata Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(30, 68, pageWidth - 60, 80, 4, 4, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);

  // Column 1
  doc.setFont('helvetica', 'bold');
  doc.text('Cost Sheet No:', 45, 86);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.cs_number, 130, 86);

  doc.setFont('helvetica', 'bold');
  doc.text('Subject / Deal:', 45, 102);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.subject.length > 35 ? sheet.subject.substring(0, 35) + '...' : sheet.subject, 130, 102);

  doc.setFont('helvetica', 'bold');
  doc.text('Customer:', 45, 118);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.account_name || 'Direct Customer', 130, 118);

  doc.setFont('helvetica', 'bold');
  doc.text('Created Date:', 45, 134);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(sheet.created_at).toLocaleDateString('en-GB'), 130, 134);

  // Column 2
  const col2X = 320;
  doc.setFont('helvetica', 'bold');
  doc.text('Business Unit:', col2X, 86);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.business_unit || 'N/A', col2X + 85, 86);

  doc.setFont('helvetica', 'bold');
  doc.text('OEM Partner:', col2X, 102);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.oem || 'N/A', col2X + 85, 102);

  doc.setFont('helvetica', 'bold');
  doc.text('Distributor:', col2X, 118);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.distributor || 'N/A', col2X + 85, 118);

  doc.setFont('helvetica', 'bold');
  doc.text('Currency:', col2X, 134);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.currency || 'INR', col2X + 85, 134);

  // Column 3
  const col3X = 580;
  doc.setFont('helvetica', 'bold');
  doc.text('Salesperson:', col3X, 86);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.salesperson_name || 'N/A', col3X + 85, 86);

  doc.setFont('helvetica', 'bold');
  doc.text('Initiator:', col3X, 102);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.initiator_name || 'N/A', col3X + 85, 102);

  doc.setFont('helvetica', 'bold');
  doc.text('Current Stage:', col3X, 118);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.status === 'Approved' ? 'All 6 Stages Completed' : `Stage ${sheet.current_stage} Pending`, col3X + 85, 118);

  // Line Items Table
  const curr = sheet.currency || 'INR';
  const tableData = (sheet.line_items || []).map((item, index) => [
    index + 1,
    item.description,
    Number(item.quantity).toLocaleString(),
    `${curr} ${Number(item.unit_purchase).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `${curr} ${Number(item.total_purchase).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `${curr} ${Number(item.unit_sale).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `${curr} ${Number(item.total_sale).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `${Number(item.margin_percentage).toFixed(2)}%`
  ]);

  autoTable(doc, {
    startY: 160,
    head: [['#', 'Item Description', 'Qty', 'Unit Purchase', 'Total Purchase', 'Unit Sale', 'Total Sale', 'Margin']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 80, halign: 'right' },
      4: { cellWidth: 85, halign: 'right' },
      5: { cellWidth: 80, halign: 'right' },
      6: { cellWidth: 85, halign: 'right' },
      7: { cellWidth: 55, halign: 'center' },
    },
    margin: { left: 30, right: 30 },
  });

  // Calculate position after table, checking for page overflow
  let finalY = (doc as any).lastAutoTable.finalY + 16;
  const sectionHeight = 125;

  if (finalY + sectionHeight > pageHeight - 30) {
    doc.addPage('landscape');
    finalY = 35;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Financial Summary & Workflow Sign-offs (${sheet.cs_number})`, 30, finalY - 12);
  }

  // Financial Breakdown Box (Right aligned with clean width and structured alignment)
  const boxWidth = 295;
  const boxX = pageWidth - boxWidth - 30;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(boxX, finalY, boxWidth, sectionHeight, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Financial Totals & Commercial Breakdown:', boxX + 12, finalY + 16);

  // Line separator
  doc.setDrawColor(226, 232, 240);
  doc.line(boxX + 10, finalY + 22, boxX + boxWidth - 10, finalY + 22);

  doc.setFontSize(8.5);
  let curY = finalY + 34;

  const addFinRow = (label: string, value: string, isBold = false, color = [15, 23, 42]) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(label, boxX + 12, curY);
    doc.text(value, boxX + boxWidth - 12, curY, { align: 'right' });
    curY += 13.5;
  };

  const totalPurchase = Number(sheet.total_purchase) || 0;
  const discountType = sheet.discount_type || 'Percentage';
  const discountVal = Number(sheet.discount_value) || 0;
  let discountAmount = 0;
  let discountLabel = 'Discount:';

  if (discountType === 'Percentage') {
    discountAmount = (totalPurchase * discountVal) / 100;
    discountLabel = `Discount (${discountVal}%):`;
  } else {
    discountAmount = discountVal;
    discountLabel = `Discount (Flat):`;
  }

  addFinRow('Total Purchase Price:', `${curr} ${totalPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  addFinRow(discountLabel, `- ${curr} ${discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, false, [220, 38, 38]);
  addFinRow('Consultation Charges:', `+ ${curr} ${(Number(sheet.consultation_charges) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  addFinRow('Freight / Shipping:', `+ ${curr} ${(Number(sheet.freight_charges) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  
  // Subtle divider before net purchase
  doc.setDrawColor(226, 232, 240);
  doc.line(boxX + 10, curY - 5, boxX + boxWidth - 10, curY - 5);

  addFinRow('Net Purchase Cost:', `${curr} ${(Number(sheet.net_purchase) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, true);
  addFinRow('Total Sale (Deal Value):', `${curr} ${(Number(sheet.total_sale) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, true, [37, 99, 235]);
  
  // Highlight box for Net Profit & Margin
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(boxX + 8, curY - 8, boxWidth - 16, 20, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 163, 74);
  doc.text('Net Profit & Margin:', boxX + 14, curY + 4);
  doc.text(`${curr} ${(Number(sheet.net_profit) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${(Number(sheet.margin_percentage) || 0).toFixed(2)}%)`, boxX + boxWidth - 14, curY + 4, { align: 'right' });

  // Sequential Approval Workflow Sign-off Section (Left side)
  const workflowWidth = boxX - 45;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(30, finalY, workflowWidth, sectionHeight, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Sequential Approval Chain Sign-offs (6 Stages):', 40, finalY + 16);

  const stageKeys = [1, 2, 3, 4, 5, 6];
  const colStep = workflowWidth / 3;
  
  stageKeys.forEach((stg, idx) => {
    const r = Math.floor(idx / 3);
    const c = idx % 3;
    const itemX = 40 + c * colStep;
    const itemY = finalY + 34 + r * 38;

    const log = (sheet.approval_logs || []).find(l => l.stage_number === stg);
    const isApproved = log?.decision === 'Approved';
    const isRejected = log?.decision === 'Rejected';
    const isCurrent = sheet.current_stage === stg && sheet.status === 'Pending';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`${stg}. ${STAGE_SHORT_NAMES[stg] || 'Stage ' + stg}`, itemX, itemY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    if (isApproved) {
      doc.setTextColor(22, 163, 74);
      doc.text(`APPROVED (${new Date(log!.timestamp).toLocaleDateString('en-GB')})`, itemX, itemY + 11);
      doc.setTextColor(100, 116, 139);
      doc.text(`By: ${log!.actor_name || 'Approver'}`, itemX, itemY + 20);
    } else if (isRejected) {
      doc.setTextColor(220, 38, 38);
      doc.text(`REJECTED`, itemX, itemY + 11);
      doc.setTextColor(100, 116, 139);
      doc.text(`By: ${log!.actor_name || 'Approver'}`, itemX, itemY + 20);
    } else if (isCurrent) {
      doc.setTextColor(217, 119, 6);
      doc.text(`AWAITING REVIEW`, itemX, itemY + 11);
    } else {
      doc.setTextColor(148, 163, 184);
      doc.text(`Pending previous stages`, itemX, itemY + 11);
    }
  });

  // Footer notes
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('This is an authenticated, internal system generated Quotation Cost Sheet from SHRO Systems Workflow Portal.', 30, pageHeight - 15);
  doc.text(`Document Ref: ${sheet.cs_number} • Exported: ${new Date().toLocaleString()}`, pageWidth - 30, pageHeight - 15, { align: 'right' });

  doc.save(`${sheet.cs_number.replace(/\//g, '_')}_Quotation.pdf`);
}

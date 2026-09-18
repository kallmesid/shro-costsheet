import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';
import { parsePdfBuffer, parseCostSheetFromPdf } from '../services/pdfParserService.ts';

const uploadDir = path.join(process.cwd(), 'uploads');
const tempDir = path.join(uploadDir, '.temp');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

export function sanitizeFolderName(name: string): string {
  if (!name || typeof name !== 'string') return 'unassigned';
  const sanitized = name.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_+/g, '_');
  return sanitized || 'unassigned';
}

export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== 'string') return `document_${Date.now()}.bin`;
  
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  
  const cleanBase = base
    .replace(/[^a-zA-Z0-9_\-\.\(\) ]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '')
    .substring(0, 100);

  const cleanExt = ext.replace(/[^a-zA-Z0-9\.]/g, '').toLowerCase().substring(0, 10);
  return `${cleanBase || 'document'}${cleanExt}`;
}

export function getUniqueFilePath(dir: string, initialFileName: string): { finalFileName: string; finalPath: string } {
  const ext = path.extname(initialFileName);
  const base = path.basename(initialFileName, ext);
  let finalFileName = initialFileName;
  let finalPath = path.join(dir, finalFileName);
  let counter = 1;

  while (fs.existsSync(finalPath)) {
    finalFileName = `${base}_(${counter})${ext}`;
    finalPath = path.join(dir, finalFileName);
    counter++;
  }

  return { finalFileName, finalPath };
}

function moveFile(source: string, destination: string) {
  try {
    fs.renameSync(source, destination);
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      fs.copyFileSync(source, destination);
      fs.unlinkSync(source);
    } else {
      throw err;
    }
  }
}

// Multer disk storage setup (saves incoming files into tempDir first)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `temp-${uniqueSuffix}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

// Generates human-readable and machine-readable manifests inside the cost sheet's folder
export async function updateDealManifest(costSheetId: number, folderName: string) {
  try {
    const sheetDir = path.join(uploadDir, folderName);
    if (!fs.existsSync(sheetDir)) {
      fs.mkdirSync(sheetDir, { recursive: true });
    }

    const sheetRes = await query(`
      SELECT cs.*, 
             acc.name as account_name,
             u_init.name as initiator_name,
             u_init.email as initiator_email,
             u_sale.name as salesperson_name,
             u_sale.email as salesperson_email
      FROM cost_sheets cs
      LEFT JOIN accounts acc ON cs.account_id = acc.id
      LEFT JOIN users u_init ON cs.initiator_id = u_init.id
      LEFT JOIN users u_sale ON cs.salesperson_id = u_sale.id
      WHERE cs.id = $1
    `, [costSheetId]);

    if (sheetRes.rows.length === 0) return;
    const sheet = sheetRes.rows[0];

    const filesRes = await query(`
      SELECT * FROM uploaded_files 
      WHERE cost_sheet_id = $1 
      ORDER BY uploaded_at ASC
    `, [costSheetId]);

    const files = filesRes.rows;

    const lines: string[] = [
      '================================================================================',
      'SHRO SYSTEMS - COST SHEET ARCHIVE MANIFEST',
      '================================================================================',
      `Cost Sheet No : ${sheet.cs_number || 'N/A'}`,
      `Database ID   : ${sheet.id}`,
      `Deal Subject  : ${sheet.subject || 'N/A'}`,
      `Customer      : ${sheet.account_name || 'N/A'}`,
      `OEM / Brand   : ${sheet.oem || 'N/A'}`,
      `Distributor   : ${sheet.distributor || 'N/A'}`,
      `Business Unit : ${sheet.business_unit || 'N/A'}`,
      `Salesperson   : ${sheet.salesperson_name || 'N/A'} (${sheet.salesperson_email || ''})`,
      `Initiator     : ${sheet.initiator_name || 'N/A'} (${sheet.initiator_email || ''})`,
      `Current Status: ${sheet.status} (Stage ${sheet.current_stage || 1})`,
      `Currency      : ${sheet.currency || 'INR'}`,
      `Total Sale    : ${Number(sheet.total_sale || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Total Purchase: ${Number(sheet.total_purchase || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Net Profit    : ${Number(sheet.net_profit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Margin %      : ${Number(sheet.margin_percentage || 0).toFixed(2)}%`,
      `Created Date  : ${sheet.created_at ? new Date(sheet.created_at).toISOString() : 'N/A'}`,
      `Last Manifest : ${new Date().toISOString()}`,
      '--------------------------------------------------------------------------------',
      'ATTACHED DOCUMENTS (PHYSICALLY STORED IN THIS DIRECTORY):',
    ];

    if (files.length === 0) {
      lines.push('  (No attachments uploaded for this cost sheet yet)');
    } else {
      files.forEach((f: any, idx: number) => {
        const sizeKb = (Number(f.file_size || 0) / 1024).toFixed(1);
        const uploadedStr = f.uploaded_at ? new Date(f.uploaded_at).toISOString() : 'Unknown';
        lines.push(`  ${idx + 1}. [${f.filename}]`);
        lines.push(`     Original Name: "${f.original_name}"`);
        lines.push(`     File Size    : ${sizeKb} KB`);
        lines.push(`     Uploaded On  : ${uploadedStr}`);
        lines.push(`     MIME Type    : ${f.mime_type || 'unknown'}`);
      });
    }

    lines.push('================================================================================');
    lines.push('* NOTE: This folder is directly recoverable without the web application or database.');
    lines.push('================================================================================');

    fs.writeFileSync(path.join(sheetDir, 'deal-info.txt'), lines.join('\n'), 'utf8');

    const metadata = {
      cs_number: sheet.cs_number,
      id: sheet.id,
      subject: sheet.subject,
      customer: sheet.account_name,
      salesperson: sheet.salesperson_name,
      initiator: sheet.initiator_name,
      status: sheet.status,
      current_stage: sheet.current_stage,
      total_sale: sheet.total_sale,
      total_purchase: sheet.total_purchase,
      margin_percentage: sheet.margin_percentage,
      created_at: sheet.created_at,
      exported_at: new Date().toISOString(),
      files: files.map((f: any) => ({
        id: f.id,
        filename: f.filename,
        original_name: f.original_name,
        file_size: f.file_size,
        mime_type: f.mime_type,
        uploaded_at: f.uploaded_at,
      })),
    };

    fs.writeFileSync(path.join(sheetDir, 'deal-metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to update deal manifest:', err);
  }
}

export async function uploadCostSheetAttachment(req: AuthRequest, res: Response) {
  const file = req.file;
  try {
    const { cost_sheet_id } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!cost_sheet_id) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'cost_sheet_id is required' });
    }

    const sheetId = parseInt(cost_sheet_id, 10);
    const sheetRes = await query('SELECT * FROM cost_sheets WHERE id = $1', [sheetId]);
    if (sheetRes.rows.length === 0) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Cost sheet not found' });
    }

    const sheet = sheetRes.rows[0];
    const folderName = sanitizeFolderName(sheet.cs_number || `CS-ID-${sheet.id}`);
    const sheetDir = path.join(uploadDir, folderName);

    if (!fs.existsSync(sheetDir)) {
      fs.mkdirSync(sheetDir, { recursive: true });
    }

    // Clean, readable filename on disk
    const cleanInitialName = sanitizeFileName(file.originalname);
    const { finalFileName, finalPath } = getUniqueFilePath(sheetDir, cleanInitialName);

    // Move file from temp to the per-cost-sheet folder
    moveFile(file.path, finalPath);

    // Web path for preview & download: /uploads/<folderName>/<finalFileName>
    const webFilePath = `/uploads/${folderName}/${finalFileName}`;

    const result = await query(`
      INSERT INTO uploaded_files (cost_sheet_id, filename, original_name, file_path, file_size, mime_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      sheetId,
      finalFileName,
      file.originalname,
      webFilePath,
      file.size,
      file.mimetype
    ]);

    // Update manifest text file in that directory
    await updateDealManifest(sheetId, folderName);

    return res.status(201).json({
      message: 'File uploaded and organized successfully',
      file: result.rows[0]
    });
  } catch (error) {
    console.error('Error handling upload:', error);
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    return res.status(500).json({ error: 'Failed to upload attachment' });
  }
}

export async function deleteCostSheetAttachment(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const fileId = parseInt(id, 10);

    const fileRes = await query(`
      SELECT uf.*, cs.cs_number 
      FROM uploaded_files uf
      LEFT JOIN cost_sheets cs ON uf.cost_sheet_id = cs.id
      WHERE uf.id = $1
    `, [fileId]);

    if (fileRes.rows.length === 0) {
      return res.status(404).json({ error: 'File record not found' });
    }

    const file = fileRes.rows[0];
    const folderName = sanitizeFolderName(file.cs_number || `CS-ID-${file.cost_sheet_id}`);
    const physicalPath = path.join(uploadDir, folderName, file.filename);

    if (fs.existsSync(physicalPath)) {
      fs.unlinkSync(physicalPath);
    } else {
      // Fallback for flat legacy path if present
      const legacyPath = path.join(uploadDir, file.filename);
      if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
      }
    }

    await query('DELETE FROM uploaded_files WHERE id = $1', [fileId]);

    await updateDealManifest(file.cost_sheet_id, folderName);

    return res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return res.status(500).json({ error: 'Failed to delete attachment' });
  }
}

export async function parsePdfForLineItems(req: AuthRequest, res: Response) {
  const file = req.file;
  try {
    if (!file) {
      return res.status(400).json({ error: 'No PDF file provided.' });
    }

    const fileBuffer = fs.readFileSync(file.path);
    const parsedData = await parseCostSheetFromPdf(fileBuffer);

    // Clean up temporary PDF immediately after parsing
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return res.json({
      message: `Parsed ${parsedData.items.length} line items from PDF with full deal metadata.`,
      sheet: parsedData,
      items: parsedData.items,
    });
  } catch (error: any) {
    console.error('PDF parsing error in uploadController:', error);
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    return res.status(500).json({ error: error.message || 'Failed to parse PDF document' });
  }
}

export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const result = await query(`
      SELECT n.*, cs.cs_number
      FROM notifications n
      LEFT JOIN cost_sheets cs ON n.cost_sheet_id = cs.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 20
    `, [req.user.id]);

    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

export async function markNotificationRead(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
    return res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error updating notification:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
}

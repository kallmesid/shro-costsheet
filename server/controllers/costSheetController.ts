import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';
import { broadcastCostSheetUpdate, sendUserNotification } from '../services/socketService.ts';
import { sendApprovalRequestEmail, sendDecisionNotificationEmail } from '../services/emailService.ts';
import { sanitizeFolderName } from './uploadController.ts';

export const STAGE_NAMES: { [key: number]: string } = {
  1: 'Finance 1 (Initial check)',
  2: 'Presales (Technical validation)',
  3: 'Management (Profitability sign-off)',
  4: 'Operations (Execution check)',
  5: 'Logistics (Shipping validation)',
  6: 'Finance 2 (Final Invoicing)',
};

export const STAGE_SHORT_NAMES: { [key: number]: string } = {
  1: 'Finance 1',
  2: 'Presales',
  3: 'Management',
  4: 'Operations',
  5: 'Logistics',
  6: 'Finance 2',
};

// Generates format: SHRO/YYYY-YY/XXX
async function generateCostSheetNumber(): Promise<string> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  
  // Indian FY: Apr (4) to Mar (3)
  const fyStart = currentMonth >= 4 ? currentYear : currentYear - 1;
  const fyEnd = (fyStart + 1) % 100;
  const fyString = `${fyStart}-${fyEnd < 10 ? '0' + fyEnd : fyEnd}`;
  const prefix = `SHRO/${fyString}/`;

  const countRes = await query(`
    SELECT COUNT(*) as cnt FROM cost_sheets WHERE cs_number LIKE $1
  `, [`${prefix}%`]);

  const nextSeq = parseInt(countRes.rows[0]?.cnt || '0', 10) + 1;
  const seqPadded = nextSeq.toString().padStart(3, '0');
  return `${prefix}${seqPadded}`;
}

export function computeDealProfitability(
  lineItems: Array<{ description?: string; unit_purchase: number; unit_sale: number; quantity: number }>,
  discountType: 'Percentage' | 'Value',
  discountValue: number,
  consultationCharges: number,
  freightCharges: number
) {
  let totalPurchase = 0;
  let totalSale = 0;

  const computedItems = lineItems.map((item) => {
    const qty = Number(item.quantity) || 1;
    const up = Number(item.unit_purchase) || 0;
    const us = Number(item.unit_sale) || 0;
    const lp = up * qty;
    const ls = us * qty;
    const margin = ls > 0 ? ((ls - lp) / ls) * 100 : 0;

    totalPurchase += lp;
    totalSale += ls;

    return {
      ...item,
      quantity: qty,
      unit_purchase: up,
      unit_sale: us,
      total_purchase: parseFloat(lp.toFixed(2)),
      total_sale: parseFloat(ls.toFixed(2)),
      margin_percentage: parseFloat(margin.toFixed(2)),
    };
  });

  const discVal = Number(discountValue) || 0;
  let discountAmount = 0;
  if (discountType === 'Percentage') {
    discountAmount = totalPurchase * (discVal / 100);
  } else {
    discountAmount = discVal;
  }

  const consult = Number(consultationCharges) || 0;
  const freight = Number(freightCharges) || 0;

  const netPurchase = Math.max(0, totalPurchase - discountAmount) + consult + freight;
  const netProfit = totalSale - netPurchase;
  const marginPercentage = totalSale > 0 ? (netProfit / totalSale) * 100 : 0;

  return {
    lineItems: computedItems,
    total_purchase: parseFloat(totalPurchase.toFixed(2)),
    total_sale: parseFloat(totalSale.toFixed(2)),
    discount_amount: parseFloat(discountAmount.toFixed(2)),
    net_purchase: parseFloat(netPurchase.toFixed(2)),
    net_profit: parseFloat(netProfit.toFixed(2)),
    margin_percentage: parseFloat(marginPercentage.toFixed(2)),
  };
}

// Get all cost sheets with filter support
export async function getAllCostSheets(req: AuthRequest, res: Response) {
  try {
    const {
      status,
      business_unit,
      salesperson_id,
      month,
      financial_year,
      my_approvals_only,
      search,
    } = req.query;

    let sql = `
      SELECT cs.*, 
             acc.name as account_name,
             u_init.name as initiator_name,
             u_sale.name as salesperson_name
      FROM cost_sheets cs
      LEFT JOIN accounts acc ON cs.account_id = acc.id
      LEFT JOIN users u_init ON cs.initiator_id = u_init.id
      LEFT JOIN users u_sale ON cs.salesperson_id = u_sale.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIndex = 1;

    if (status && status !== 'All') {
      sql += ` AND cs.status = $${pIndex++}`;
      params.push(status);
    }

    if (business_unit && business_unit !== 'All') {
      sql += ` AND cs.business_unit = $${pIndex++}`;
      params.push(business_unit);
    }

    if (salesperson_id && salesperson_id !== 'All') {
      sql += ` AND cs.salesperson_id = $${pIndex++}`;
      params.push(salesperson_id);
    }

    if (month && month !== 'All') {
      sql += ` AND EXTRACT(MONTH FROM cs.created_at) = $${pIndex++}`;
      params.push(parseInt(month as string, 10));
    }

    if (financial_year && financial_year !== 'All') {
      sql += ` AND cs.cs_number LIKE $${pIndex++}`;
      params.push(`%${financial_year}%`);
    }

    if (my_approvals_only === 'true' && req.user) {
      sql += ` AND cs.status = 'Pending' AND (
        (cs.assigned_approvers->>cs.current_stage::text)::int = $${pIndex++}
        OR ($${pIndex++} = 'Admin')
      )`;
      params.push(req.user.id, req.user.access_level);
    }

    if (search) {
      sql += ` AND (
        cs.cs_number ILIKE $${pIndex}
        OR cs.subject ILIKE $${pIndex}
        OR acc.name ILIKE $${pIndex}
      )`;
      params.push(`%${search}%`);
      pIndex++;
    }

    sql += ` ORDER BY cs.created_at DESC`;

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cost sheets:', error);
    return res.status(500).json({ error: 'Failed to fetch cost sheets' });
  }
}

// Get cost sheet by ID with lines, logs, and files
export async function getCostSheetById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const sheetRes = await query(`
      SELECT cs.*,
             acc.name as account_name,
             acc.industry as account_industry,
             acc.phone as account_phone,
             acc.email as account_email,
             acc.contacts as account_contacts,
             u_init.name as initiator_name,
             u_init.email as initiator_email,
             u_sale.name as salesperson_name,
             u_sale.email as salesperson_email
      FROM cost_sheets cs
      LEFT JOIN accounts acc ON cs.account_id = acc.id
      LEFT JOIN users u_init ON cs.initiator_id = u_init.id
      LEFT JOIN users u_sale ON cs.salesperson_id = u_sale.id
      WHERE cs.id = $1
    `, [id]);

    if (sheetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cost sheet not found' });
    }

    const sheet = sheetRes.rows[0];

    const linesRes = await query(`
      SELECT * FROM line_items WHERE cost_sheet_id = $1 ORDER BY id ASC
    `, [id]);

    const logsRes = await query(`
      SELECT al.*, u.name as actor_name, u.role as actor_role
      FROM approval_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE al.cost_sheet_id = $1
      ORDER BY al.timestamp ASC, al.id ASC
    `, [id]);

    const filesRes = await query(`
      SELECT * FROM uploaded_files WHERE cost_sheet_id = $1 ORDER BY uploaded_at DESC
    `, [id]);

    // Check if logged in user is eligible to approve currently
    let canUserApprove = false;
    if (sheet.status === 'Pending' && req.user) {
      const assignedApproverId = sheet.assigned_approvers?.[sheet.current_stage?.toString()];
      if (assignedApproverId === req.user.id || req.user.access_level === 'Admin') {
        canUserApprove = true;
      }
    }

    return res.json({
      ...sheet,
      line_items: linesRes.rows,
      approval_logs: logsRes.rows,
      files: filesRes.rows,
      can_user_approve: canUserApprove,
      current_stage_name: STAGE_NAMES[sheet.current_stage] || 'Complete',
    });
  } catch (error) {
    console.error('Error fetching cost sheet detail:', error);
    return res.status(500).json({ error: 'Failed to fetch cost sheet details' });
  }
}

// Create new cost sheet
export async function createCostSheet(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      subject,
      account_id,
      salesperson_id,
      distributor,
      business_unit,
      oem,
      currency = 'INR',
      discount_type = 'Percentage',
      discount_value = 0,
      consultation_charges = 0,
      freight_charges = 0,
      line_items = [],
      assigned_approvers = {},
      notes = '',
      submit_for_approval = false,
    } = req.body;

    if (!subject || subject.trim() === '') {
      return res.status(400).json({ error: 'Deal Subject is required.' });
    }

    const cs_number = await generateCostSheetNumber();
    const metrics = computeDealProfitability(
      line_items,
      discount_type,
      discount_value,
      consultation_charges,
      freight_charges
    );

    const initialStatus = submit_for_approval ? 'Pending' : 'Draft';
    const initialStage = 1;

    const sheetRes = await query(`
      INSERT INTO cost_sheets (
        cs_number, status, subject, initiator_id, salesperson_id, account_id,
        distributor, business_unit, oem, currency, discount_type, discount_value,
        consultation_charges, freight_charges, total_purchase, total_sale,
        net_purchase, net_profit, margin_percentage, current_stage, assigned_approvers, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `, [
      cs_number,
      initialStatus,
      subject.trim(),
      req.user.id,
      salesperson_id || req.user.id,
      account_id || null,
      distributor || '',
      business_unit || '',
      oem || '',
      currency,
      discount_type,
      discount_value,
      consultation_charges,
      freight_charges,
      metrics.total_purchase,
      metrics.total_sale,
      metrics.net_purchase,
      metrics.net_profit,
      metrics.margin_percentage,
      initialStage,
      JSON.stringify(assigned_approvers),
      notes || ''
    ]);

    const createdSheet = sheetRes.rows[0];

    // Insert line items
    for (const item of metrics.lineItems) {
      await query(`
        INSERT INTO line_items (cost_sheet_id, description, unit_purchase, unit_sale, quantity, total_purchase, total_sale, margin_percentage)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        createdSheet.id,
        item.description,
        item.unit_purchase,
        item.unit_sale,
        item.quantity,
        item.total_purchase,
        item.total_sale,
        item.margin_percentage
      ]);
    }

    if (submit_for_approval) {
      // Notify stage 1 approver
      const stage1ApproverId = assigned_approvers['1'];
      if (stage1ApproverId) {
        const approverRes = await query('SELECT email, name FROM users WHERE id = $1', [stage1ApproverId]);
        if (approverRes.rows.length > 0) {
          const approver = approverRes.rows[0];
          await query(`
            INSERT INTO notifications (user_id, title, message, cost_sheet_id)
            VALUES ($1, $2, $3, $4)
          `, [
            stage1ApproverId,
            `Action Required: Cost Sheet ${cs_number}`,
            `New cost sheet submitted for Stage 1: Finance 1 check.`,
            createdSheet.id
          ]);

          sendUserNotification(stage1ApproverId, {
            title: `Action Required: Cost Sheet ${cs_number}`,
            message: `New cost sheet submitted for Stage 1: Finance 1 check.`,
            cost_sheet_id: createdSheet.id
          });

          sendApprovalRequestEmail(
            approver.email,
            approver.name,
            cs_number,
            subject,
            STAGE_NAMES[1],
            metrics.total_sale,
            metrics.margin_percentage
          );
        }
      }
    }

    broadcastCostSheetUpdate(createdSheet.id, {
      status: createdSheet.status,
      current_stage: createdSheet.current_stage,
      cs_number: createdSheet.cs_number,
    });

    return res.status(201).json(createdSheet);
  } catch (error) {
    console.error('Error creating cost sheet:', error);
    return res.status(500).json({ error: 'Failed to create cost sheet' });
  }
}

// Update cost sheet
export async function updateCostSheet(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM cost_sheets WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Cost sheet not found' });
    }

    const current = existing.rows[0];
    if (current.status === 'Approved') {
      return res.status(400).json({ error: 'Cannot modify an already Approved cost sheet.' });
    }

    const {
      subject,
      account_id,
      salesperson_id,
      distributor,
      business_unit,
      oem,
      currency,
      discount_type,
      discount_value,
      consultation_charges,
      freight_charges,
      line_items = [],
      assigned_approvers,
      notes,
    } = req.body;

    const metrics = computeDealProfitability(
      line_items,
      discount_type ?? current.discount_type,
      discount_value ?? current.discount_value,
      consultation_charges ?? current.consultation_charges,
      freight_charges ?? current.freight_charges
    );

    await query(`
      UPDATE cost_sheets
      SET subject = $1,
          account_id = $2,
          salesperson_id = $3,
          distributor = $4,
          business_unit = $5,
          oem = $6,
          currency = $7,
          discount_type = $8,
          discount_value = $9,
          consultation_charges = $10,
          freight_charges = $11,
          total_purchase = $12,
          total_sale = $13,
          net_purchase = $14,
          net_profit = $15,
          margin_percentage = $16,
          assigned_approvers = $17,
          notes = $18,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $19
    `, [
      subject ?? current.subject,
      account_id ?? current.account_id,
      salesperson_id ?? current.salesperson_id,
      distributor ?? current.distributor,
      business_unit ?? current.business_unit,
      oem ?? current.oem,
      currency ?? current.currency,
      discount_type ?? current.discount_type,
      discount_value ?? current.discount_value,
      consultation_charges ?? current.consultation_charges,
      freight_charges ?? current.freight_charges,
      metrics.total_purchase,
      metrics.total_sale,
      metrics.net_purchase,
      metrics.net_profit,
      metrics.margin_percentage,
      JSON.stringify(assigned_approvers ?? current.assigned_approvers),
      notes ?? current.notes,
      id
    ]);

    // Replace line items
    await query('DELETE FROM line_items WHERE cost_sheet_id = $1', [id]);
    for (const item of metrics.lineItems) {
      await query(`
        INSERT INTO line_items (cost_sheet_id, description, unit_purchase, unit_sale, quantity, total_purchase, total_sale, margin_percentage)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id,
        item.description,
        item.unit_purchase,
        item.unit_sale,
        item.quantity,
        item.total_purchase,
        item.total_sale,
        item.margin_percentage
      ]);
    }

    broadcastCostSheetUpdate(parseInt(id, 10), {
      status: current.status,
      current_stage: current.current_stage,
      cs_number: current.cs_number,
    });

    return res.json({ message: 'Cost sheet updated successfully' });
  } catch (error) {
    console.error('Error updating cost sheet:', error);
    return res.status(500).json({ error: 'Failed to update cost sheet' });
  }
}

// Submit draft sheet for approval
export async function submitForApproval(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const sheetRes = await query('SELECT * FROM cost_sheets WHERE id = $1', [id]);
    if (sheetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cost sheet not found' });
    }

    const sheet = sheetRes.rows[0];
    if (sheet.status !== 'Draft' && sheet.status !== 'Rejected') {
      return res.status(400).json({ error: `Cannot submit sheet in ${sheet.status} status.` });
    }

    await query(`
      UPDATE cost_sheets
      SET status = 'Pending', current_stage = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    // Notify stage 1 approver
    const stage1ApproverId = sheet.assigned_approvers?.['1'];
    if (stage1ApproverId) {
      const approverRes = await query('SELECT email, name FROM users WHERE id = $1', [stage1ApproverId]);
      if (approverRes.rows.length > 0) {
        const approver = approverRes.rows[0];
        await query(`
          INSERT INTO notifications (user_id, title, message, cost_sheet_id)
          VALUES ($1, $2, $3, $4)
        `, [
          stage1ApproverId,
          `Action Required: Cost Sheet ${sheet.cs_number}`,
          `Submitted for Stage 1: Finance 1 approval check.`,
          id
        ]);

        sendUserNotification(stage1ApproverId, {
          title: `Action Required: Cost Sheet ${sheet.cs_number}`,
          message: `Submitted for Stage 1: Finance 1 approval check.`,
          cost_sheet_id: id
        });

        sendApprovalRequestEmail(
          approver.email,
          approver.name,
          sheet.cs_number,
          sheet.subject,
          STAGE_NAMES[1],
          sheet.total_sale,
          sheet.margin_percentage
        );
      }
    }

    broadcastCostSheetUpdate(parseInt(id, 10), {
      status: 'Pending',
      current_stage: 1,
      cs_number: sheet.cs_number
    });

    return res.json({ message: 'Cost sheet submitted for approval routing.' });
  } catch (error) {
    console.error('Error submitting cost sheet:', error);
    return res.status(500).json({ error: 'Failed to submit cost sheet' });
  }
}

// Approve current stage
export async function approveStage(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { comment = '' } = req.body;

    const sheetRes = await query(`
      SELECT cs.*, u.email as initiator_email, u.name as initiator_name
      FROM cost_sheets cs
      LEFT JOIN users u ON cs.initiator_id = u.id
      WHERE cs.id = $1
    `, [id]);

    if (sheetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cost sheet not found' });
    }

    const sheet = sheetRes.rows[0];
    if (sheet.status !== 'Pending') {
      return res.status(400).json({ error: `Cannot approve sheet with status ${sheet.status}` });
    }

    const currentStage = sheet.current_stage || 1;
    const assignedApproverId = sheet.assigned_approvers?.[currentStage.toString()];

    // Verify permission
    if (assignedApproverId !== req.user.id && req.user.access_level !== 'Admin') {
      return res.status(403).json({ error: 'You are not assigned as the approver for this stage.' });
    }

    const stageName = STAGE_NAMES[currentStage] || `Stage ${currentStage}`;

    // Log approval
    await query(`
      INSERT INTO approval_logs (cost_sheet_id, stage_name, stage_number, actor_id, decision, comment)
      VALUES ($1, $2, $3, $4, 'Approved', $5)
    `, [id, stageName, currentStage, req.user.id, comment.trim()]);

    const isFinalStage = currentStage >= 6;
    const nextStage = isFinalStage ? 7 : currentStage + 1;
    const newStatus = isFinalStage ? 'Approved' : 'Pending';

    await query(`
      UPDATE cost_sheets
      SET current_stage = $1, status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [nextStage, newStatus, id]);

    // Send email notification to initiator
    sendDecisionNotificationEmail(
      sheet.initiator_email,
      sheet.initiator_name,
      sheet.cs_number,
      sheet.subject,
      'Approved',
      stageName,
      req.user.name,
      comment
    );

    // If next stage exists, notify next stage approver
    if (!isFinalStage) {
      const nextApproverId = sheet.assigned_approvers?.[nextStage.toString()];
      if (nextApproverId) {
        const nextApproverRes = await query('SELECT email, name FROM users WHERE id = $1', [nextApproverId]);
        if (nextApproverRes.rows.length > 0) {
          const nextApprover = nextApproverRes.rows[0];
          await query(`
            INSERT INTO notifications (user_id, title, message, cost_sheet_id)
            VALUES ($1, $2, $3, $4)
          `, [
            nextApproverId,
            `Action Required: Cost Sheet ${sheet.cs_number}`,
            `Awaiting your review at Stage ${nextStage}: ${STAGE_NAMES[nextStage]}`,
            id
          ]);

          sendUserNotification(nextApproverId, {
            title: `Action Required: Cost Sheet ${sheet.cs_number}`,
            message: `Awaiting your review at Stage ${nextStage}: ${STAGE_NAMES[nextStage]}`,
            cost_sheet_id: id
          });

          sendApprovalRequestEmail(
            nextApprover.email,
            nextApprover.name,
            sheet.cs_number,
            sheet.subject,
            STAGE_NAMES[nextStage],
            sheet.total_sale,
            sheet.margin_percentage
          );
        }
      }
    } else {
      // Notify initiator of overall completion
      await query(`
        INSERT INTO notifications (user_id, title, message, cost_sheet_id)
        VALUES ($1, $2, $3, $4)
      `, [
        sheet.initiator_id,
        `Cost Sheet Approved: ${sheet.cs_number}`,
        `Your cost sheet has successfully completed all 6 approval stages and is fully Approved.`,
        id
      ]);

      sendUserNotification(sheet.initiator_id, {
        title: `Cost Sheet Approved: ${sheet.cs_number}`,
        message: `Your cost sheet has completed all 6 stages and is Approved.`,
        cost_sheet_id: id
      });
    }

    broadcastCostSheetUpdate(parseInt(id, 10), {
      status: newStatus,
      current_stage: nextStage,
      cs_number: sheet.cs_number,
      approved_by: req.user.name
    });

    return res.json({
      message: isFinalStage ? 'Cost sheet fully approved!' : `Stage ${currentStage} approved, routed to Stage ${nextStage}.`,
      status: newStatus,
      current_stage: nextStage
    });
  } catch (error) {
    console.error('Error approving cost sheet:', error);
    return res.status(500).json({ error: 'Failed to process approval.' });
  }
}

// Reject current stage
export async function rejectStage(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { comment = '' } = req.body;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ error: 'A comment/reason is required when rejecting a cost sheet.' });
    }

    const sheetRes = await query(`
      SELECT cs.*, u.email as initiator_email, u.name as initiator_name
      FROM cost_sheets cs
      LEFT JOIN users u ON cs.initiator_id = u.id
      WHERE cs.id = $1
    `, [id]);

    if (sheetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cost sheet not found' });
    }

    const sheet = sheetRes.rows[0];
    if (sheet.status !== 'Pending') {
      return res.status(400).json({ error: `Cannot reject sheet with status ${sheet.status}` });
    }

    const currentStage = sheet.current_stage || 1;
    const assignedApproverId = sheet.assigned_approvers?.[currentStage.toString()];

    // Verify permission
    if (assignedApproverId !== req.user.id && req.user.access_level !== 'Admin') {
      return res.status(403).json({ error: 'You are not assigned as the approver for this stage.' });
    }

    const stageName = STAGE_NAMES[currentStage] || `Stage ${currentStage}`;

    // Log rejection
    await query(`
      INSERT INTO approval_logs (cost_sheet_id, stage_name, stage_number, actor_id, decision, comment)
      VALUES ($1, $2, $3, $4, 'Rejected', $5)
    `, [id, stageName, currentStage, req.user.id, comment.trim()]);

    await query(`
      UPDATE cost_sheets
      SET status = 'Rejected', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    // Send rejection email to initiator
    sendDecisionNotificationEmail(
      sheet.initiator_email,
      sheet.initiator_name,
      sheet.cs_number,
      sheet.subject,
      'Rejected',
      stageName,
      req.user.name,
      comment
    );

    // Add in-app notification to initiator
    await query(`
      INSERT INTO notifications (user_id, title, message, cost_sheet_id)
      VALUES ($1, $2, $3, $4)
    `, [
      sheet.initiator_id,
      `Cost Sheet Rejected: ${sheet.cs_number}`,
      `Rejected at ${stageName} by ${req.user.name}. Reason: ${comment}`,
      id
    ]);

    sendUserNotification(sheet.initiator_id, {
      title: `Cost Sheet Rejected: ${sheet.cs_number}`,
      message: `Rejected at ${stageName} by ${req.user.name}. Reason: ${comment}`,
      cost_sheet_id: id
    });

    broadcastCostSheetUpdate(parseInt(id, 10), {
      status: 'Rejected',
      current_stage: currentStage,
      cs_number: sheet.cs_number,
      rejected_by: req.user.name
    });

    return res.json({
      message: `Cost sheet rejected at ${stageName}. Initiator has been notified.`,
      status: 'Rejected'
    });
  } catch (error) {
    console.error('Error rejecting cost sheet:', error);
    return res.status(500).json({ error: 'Failed to process rejection.' });
  }
}

// Delete cost sheet
export async function deleteCostSheet(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const sheetRes = await query('SELECT * FROM cost_sheets WHERE id = $1', [id]);
    if (sheetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cost sheet not found' });
    }

    const sheet = sheetRes.rows[0];
    if (sheet.status !== 'Draft' && req.user?.access_level !== 'Admin') {
      return res.status(403).json({ error: 'Only Draft sheets can be deleted by regular users.' });
    }

    await query('DELETE FROM cost_sheets WHERE id = $1', [id]);

    // Clean up physical files and folder from disk
    try {
      const folderName = sanitizeFolderName(sheet.cs_number || `CS-ID-${sheet.id}`);
      const sheetDir = path.join(process.cwd(), 'uploads', folderName);
      if (fs.existsSync(sheetDir)) {
        fs.rmSync(sheetDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.warn('Failed to clean up cost sheet files on disk:', cleanupErr);
    }

    return res.json({ message: 'Cost sheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting cost sheet:', error);
    return res.status(500).json({ error: 'Failed to delete cost sheet' });
  }
}

import nodemailer from 'nodemailer';
import { query } from '../config/db.ts';

// Dynamic transporter cache
let cachedTransporter: any = null;
let lastConfigHash: string = '';

export async function getEmailConfigSettings() {
  try {
    const res = await query("SELECT value FROM portal_settings WHERE key = 'email'");
    const dbConfig = res.rows[0]?.value || {};
    
    return {
      host: dbConfig.smtp_host || process.env.SMTP_HOST,
      port: parseInt(dbConfig.smtp_port || process.env.SMTP_PORT || '587', 10),
      secure: dbConfig.smtp_secure === true || process.env.SMTP_SECURE === 'true',
      user: dbConfig.smtp_user || process.env.SMTP_USER,
      pass: dbConfig.smtp_password || process.env.SMTP_PASS,
      fromEmail: dbConfig.from_email || process.env.SMTP_FROM || dbConfig.smtp_user || process.env.SMTP_USER || 'no-reply@shrosystems.com',
      fromName: dbConfig.from_name || 'SHRO Quotation Workflow',
      notifyOnSubmission: dbConfig.notify_on_submission !== false,
      notifyOnApproval: dbConfig.notify_on_approval !== false,
      notifyOnRejection: dbConfig.notify_on_rejection !== false,
    };
  } catch (err) {
    console.warn('[EmailService] Falling back to process.env config:', err);
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromEmail: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@shrosystems.com',
      fromName: 'SHRO Quotation Workflow',
      notifyOnSubmission: true,
      notifyOnApproval: true,
      notifyOnRejection: true,
    };
  }
}

async function getTransporter() {
  const cfg = await getEmailConfigSettings();
  const currentHash = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.secure}:${cfg.pass ? 'haspass' : 'nopass'}`;

  if (!cachedTransporter || currentHash !== lastConfigHash) {
    lastConfigHash = currentHash;
    if (cfg.host && cfg.user && cfg.pass) {
      cachedTransporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: {
          user: cfg.user,
          pass: cfg.pass,
        },
      });
      console.log(`[EmailService] Configured live SMTP transport with host ${cfg.host}:${cfg.port} as ${cfg.user}`);
    } else {
      // Test / simulation mode transporter (logs to console cleanly)
      cachedTransporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
      console.log('[EmailService] Using simulated email transporter (no live SMTP credentials provided)');
    }
  }
  return { transporter: cachedTransporter, config: cfg };
}

export async function sendApprovalRequestEmail(approverEmail: string, approverName: string, csNumber: string, subject: string, stageName: string, totalSale: number, margin: number) {
  try {
    const { transporter: t, config: cfg } = await getTransporter();
    if (!cfg.notifyOnSubmission && stageName.includes('Stage 1')) {
      return;
    }

    const fromAddress = `"${cfg.fromName}" <${cfg.fromEmail}>`;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const mailOptions = {
      from: fromAddress,
      to: approverEmail,
      subject: `[Action Required] Approval Needed: Cost Sheet ${csNumber} - Stage: ${stageName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">SHRO Systems - Cost Sheet Approval Workflow</h2>
          <p>Hello <strong>${approverName}</strong>,</p>
          <p>A sales quotation cost sheet is waiting for your review and sign-off at <strong>${stageName}</strong>:</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Cost Sheet No:</strong> ${csNumber}</p>
            <p style="margin: 4px 0;"><strong>Subject:</strong> ${subject}</p>
            <p style="margin: 4px 0;"><strong>Total Deal Value:</strong> ₹${Number(totalSale).toLocaleString('en-IN')}</p>
            <p style="margin: 4px 0;"><strong>Margin:</strong> ${Number(margin).toFixed(2)}%</p>
            <p style="margin: 4px 0;"><strong>Current Stage:</strong> <span style="color: #2563eb; font-weight: bold;">${stageName}</span></p>
          </div>
          <p>Please log in to the SHRO Cost Sheet Portal to inspect line items, verify profitability metrics, and submit your decision.</p>
          <div style="margin: 20px 0;">
            <a href="${appUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Cost Sheet Portal</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">This is an automated notification from SHRO Systems Internal Sales Portal.</p>
        </div>
      `,
    };

    const info = await t.sendMail(mailOptions);
    console.log(`[Email Sent] Approval request to ${approverEmail} for ${csNumber} (${stageName})`);
    return info;
  } catch (error) {
    console.error('Failed to send approval email:', error);
  }
}

export async function sendDecisionNotificationEmail(initiatorEmail: string, initiatorName: string, csNumber: string, subject: string, decision: 'Approved' | 'Rejected', stageName: string, actorName: string, comment?: string) {
  try {
    const { transporter: t, config: cfg } = await getTransporter();
    
    // Check preferences
    if (decision === 'Approved' && !cfg.notifyOnApproval) return;
    if (decision === 'Rejected' && !cfg.notifyOnRejection) return;

    const isApproved = decision === 'Approved';
    const color = isApproved ? '#16a34a' : '#dc2626';

    const fromAddress = `"${cfg.fromName}" <${cfg.fromEmail}>`;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const mailOptions = {
      from: fromAddress,
      to: initiatorEmail,
      subject: `[Status Update: ${decision}] Cost Sheet ${csNumber} by ${actorName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">SHRO Systems - Cost Sheet Status Update</h2>
          <p>Hello <strong>${initiatorName}</strong>,</p>
          <p>Your quotation cost sheet has received a status update:</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Cost Sheet No:</strong> ${csNumber}</p>
            <p style="margin: 4px 0;"><strong>Subject:</strong> ${subject}</p>
            <p style="margin: 4px 0;"><strong>Stage:</strong> ${stageName}</p>
            <p style="margin: 4px 0;"><strong>Decision:</strong> <span style="color: ${color}; font-weight: bold; text-transform: uppercase;">${decision}</span></p>
            <p style="margin: 4px 0;"><strong>Reviewer:</strong> ${actorName}</p>
            ${comment ? `<p style="margin: 4px 0;"><strong>Reviewer Remarks:</strong> <em>"${comment}"</em></p>` : ''}
          </div>
          <p>${isApproved ? 'The sheet has moved to the next sequential stage or is fully approved.' : 'Please review the reviewer remarks and revise the cost sheet if necessary.'}</p>
          <div style="margin: 20px 0;">
            <a href="${appUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View in Cost Sheet Portal</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">This is an automated notification from SHRO Systems Internal Sales Portal.</p>
        </div>
      `,
    };

    const info = await t.sendMail(mailOptions);
    console.log(`[Email Sent] Decision update to ${initiatorEmail} for ${csNumber} (${decision})`);
    return info;
  } catch (error) {
    console.error('Failed to send decision email:', error);
  }
}

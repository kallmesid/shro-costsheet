import { Response } from 'express';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';

export async function getDropdowns(req: AuthRequest, res: Response) {
  try {
    const result = await query(`
      SELECT * FROM dropdown_options WHERE is_active = TRUE ORDER BY category ASC, name ASC
    `);

    const grouped: { [key: string]: string[] } = {
      business_unit: [],
      oem: [],
      distributor: []
    };

    for (const item of result.rows) {
      if (grouped[item.category]) {
        grouped[item.category].push(item.name);
      }
    }

    return res.json({
      raw: result.rows,
      grouped
    });
  } catch (error) {
    console.error('Error fetching dropdowns:', error);
    return res.status(500).json({ error: 'Failed to fetch dropdown options' });
  }
}

export async function addDropdownItem(req: AuthRequest, res: Response) {
  try {
    const { category, name } = req.body;
    if (!category || !name || name.trim() === '') {
      return res.status(400).json({ error: 'Category and Name are required' });
    }

    const existing = await query('SELECT id FROM dropdown_options WHERE category = $1 AND name = $2', [category, name.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Option already exists in this category' });
    }

    const result = await query(`
      INSERT INTO dropdown_options (category, name)
      VALUES ($1, $2)
      RETURNING *
    `, [category, name.trim()]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding dropdown item:', error);
    return res.status(500).json({ error: 'Failed to add option' });
  }
}

export async function deleteDropdownItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    await query('DELETE FROM dropdown_options WHERE id = $1', [id]);
    return res.json({ message: 'Option deleted successfully' });
  } catch (error) {
    console.error('Error deleting dropdown item:', error);
    return res.status(500).json({ error: 'Failed to delete option' });
  }
}

export async function getBranding(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT value FROM portal_settings WHERE key = 'branding'");
    if (result.rows.length === 0) {
      return res.json({});
    }
    return res.json(result.rows[0].value);
  } catch (error) {
    console.error('Error getting branding:', error);
    return res.status(500).json({ error: 'Failed to fetch branding settings' });
  }
}

export async function updateBranding(req: AuthRequest, res: Response) {
  try {
    if (req.user?.access_level !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can update branding' });
    }
    const newBranding = req.body;
    await query(`
      INSERT INTO portal_settings (key, value, updated_at)
      VALUES ('branding', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(newBranding)]);

    return res.json({ message: 'Branding settings updated successfully', branding: newBranding });
  } catch (error) {
    console.error('Error updating branding:', error);
    return res.status(500).json({ error: 'Failed to update branding settings' });
  }
}

export async function getEmailConfig(req: AuthRequest, res: Response) {
  try {
    const result = await query("SELECT value FROM portal_settings WHERE key = 'email'");
    if (result.rows.length === 0) {
      return res.json({});
    }
    const emailConfig = { ...result.rows[0].value };
    // Mask password before returning to client
    if (emailConfig.smtp_password) {
      emailConfig.smtp_password_configured = true;
      emailConfig.smtp_password = '••••••••';
    } else {
      emailConfig.smtp_password_configured = false;
    }
    return res.json(emailConfig);
  } catch (error) {
    console.error('Error getting email config:', error);
    return res.status(500).json({ error: 'Failed to fetch email settings' });
  }
}

export async function updateEmailConfig(req: AuthRequest, res: Response) {
  try {
    if (req.user?.access_level !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can update email settings' });
    }
    const { smtp_password, ...rest } = req.body;
    
    // Fetch existing config to preserve password if not changed
    const current = await query("SELECT value FROM portal_settings WHERE key = 'email'");
    let finalPassword = '';
    if (current.rows.length > 0 && current.rows[0].value?.smtp_password) {
      finalPassword = current.rows[0].value.smtp_password;
    }
    if (smtp_password && smtp_password !== '••••••••') {
      finalPassword = smtp_password;
    }

    const toSave = {
      ...rest,
      smtp_password: finalPassword,
    };

    await query(`
      INSERT INTO portal_settings (key, value, updated_at)
      VALUES ('email', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(toSave)]);

    return res.json({ message: 'Email configuration updated successfully' });
  } catch (error) {
    console.error('Error updating email config:', error);
    return res.status(500).json({ error: 'Failed to update email settings' });
  }
}

import nodemailer from 'nodemailer';
import { getEmailConfigSettings } from '../services/emailService.ts';

export async function testEmailConfig(req: AuthRequest, res: Response) {
  try {
    const { recipient } = req.body;
    const targetEmail = recipient || req.user?.email || 'admin@shrosystems.com';

    const cfg = await getEmailConfigSettings();

    if (!cfg.host) {
      return res.status(400).json({ error: 'SMTP Host has not been configured yet (in UI or environment variables).' });
    }

    if (cfg.host && cfg.user && cfg.pass) {
      // Attempt actual SMTP handshake & test email
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: {
          user: cfg.user,
          pass: cfg.pass,
        },
      });

      // Verify connection
      await transporter.verify();

      // Send actual test email
      await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: targetEmail,
        subject: '[Test] SHRO Cost Sheet Portal - SMTP Verification',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px;">
            <h3 style="color: #0f172a; margin-top: 0;">SHRO Portal SMTP Test Succeeded</h3>
            <p>This is a verification email sent from your SHRO Quotation Workflow System.</p>
            <p><strong>SMTP Host:</strong> ${cfg.host}:${cfg.port}</p>
            <p><strong>Sender:</strong> ${cfg.fromEmail}</p>
            <p style="color: #16a34a; font-weight: bold;">Connection and authentication verified successfully!</p>
          </div>
        `
      });

      return res.json({
        success: true,
        message: `Live test email delivered successfully to ${targetEmail} via ${cfg.host}:${cfg.port}. SMTP authentication and delivery verified!`,
        config: {
          host: cfg.host,
          port: cfg.port,
          from: cfg.fromEmail,
          recipient: targetEmail,
        }
      });
    } else {
      // In sandbox/test mode without credentials
      return res.json({
        success: true,
        message: `Test email simulated for ${targetEmail}. Host: ${cfg.host}:${cfg.port}. Note: Enter SMTP User & Password to send live external emails.`,
        config: {
          host: cfg.host,
          port: cfg.port,
          from: cfg.fromEmail,
          recipient: targetEmail,
        }
      });
    }
  } catch (error: any) {
    console.error('Error testing email config:', error);
    return res.status(500).json({ error: `SMTP Connection failed: ${error.message}` });
  }
}


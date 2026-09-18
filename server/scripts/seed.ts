import bcrypt from 'bcryptjs';
import { query } from '../config/db.ts';

export async function runSeed() {
  console.log('Running seed script...');

  // Check if admin user already exists
  const existingAdmin = await query("SELECT id FROM users WHERE username = 'vaibhav.g'");
  
  if (existingAdmin.rows.length === 0) {
    console.log('Creating initial admin user vaibhav.g with bcrypt (12 rounds)...');
    const adminPasswordHash = await bcrypt.hash('Shro@2026', 12);
    const userPasswordHash = await bcrypt.hash('User@2026', 12);

    // Seed users
    const adminRes = await query(`
      INSERT INTO users (name, username, email, password_hash, role, access_level, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, ['Vaibhav G', 'vaibhav.g', 'vaibhav.g@shrosystems.com', adminPasswordHash, 'Management', 'Admin', 'Active']);

    const adminId = adminRes.rows[0].id;

    // Seed additional department users for all 6 approval stages + Sales
    const u1 = await query(`
      INSERT INTO users (name, username, email, password_hash, role, access_level, status, report_to_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, ['Anita Sharma', 'anita.fin', 'anita.fin@shrosystems.com', userPasswordHash, 'Finance', 'TeamLead', 'Active', adminId]);

    const u2 = await query(`
      INSERT INTO users (name, username, email, password_hash, role, access_level, status, report_to_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, ['Rahul Verma', 'rahul.pre', 'rahul.pre@shrosystems.com', userPasswordHash, 'Presales', 'TeamLead', 'Active', adminId]);

    const u3 = await query(`
      INSERT INTO users (name, username, email, password_hash, role, access_level, status, report_to_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, ['Vikram Malhotra', 'vikram.mgmt', 'vikram.mgmt@shrosystems.com', userPasswordHash, 'Management', 'Management', 'Active', adminId]);

    const u4 = await query(`
      INSERT INTO users (name, username, email, password_hash, role, access_level, status, report_to_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, ['Sunil Kulkarni', 'sunil.ops', 'sunil.ops@shrosystems.com', userPasswordHash, 'Operations', 'User', 'Active', adminId]);

    const u5 = await query(`
      INSERT INTO users (name, username, email, password_hash, role, access_level, status, report_to_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, ['Deepak Patel', 'deepak.log', 'deepak.log@shrosystems.com', userPasswordHash, 'Logistics', 'User', 'Active', adminId]);

    const u6 = await query(`
      INSERT INTO users (name, username, email, password_hash, role, access_level, status, report_to_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, ['Priya Nair', 'priya.fin2', 'priya.fin2@shrosystems.com', userPasswordHash, 'Finance', 'Management', 'Active', adminId]);

    const u7 = await query(`
      INSERT INTO users (name, username, email, password_hash, role, access_level, status, report_to_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, ['Ajay Kumar', 'sales.ajay', 'ajay.k@shrosystems.com', userPasswordHash, 'Sales', 'User', 'Active', adminId]);

    // Seed Teams
    const teamRes = await query(`
      INSERT INTO teams (name, lead_id)
      VALUES ($1, $2) RETURNING id
    `, ['Enterprise West Sales Team', u7.rows[0].id]);
    
    await query(`
      INSERT INTO team_members (team_id, user_id)
      VALUES ($1, $2), ($1, $3)
    `, [teamRes.rows[0].id, u7.rows[0].id, adminId]);

    // Seed Dropdown options
    const dropdowns = [
      { category: 'business_unit', name: 'Cloud Infrastructure' },
      { category: 'business_unit', name: 'Cyber Security' },
      { category: 'business_unit', name: 'Enterprise Networking' },
      { category: 'business_unit', name: 'Data Center Solutions' },
      { category: 'business_unit', name: 'Software & Licensing' },
      { category: 'oem', name: 'Cisco Systems' },
      { category: 'oem', name: 'Dell Technologies' },
      { category: 'oem', name: 'HPE / Aruba' },
      { category: 'oem', name: 'Fortinet' },
      { category: 'oem', name: 'Palo Alto Networks' },
      { category: 'oem', name: 'Microsoft' },
      { category: 'distributor', name: 'Redington India' },
      { category: 'distributor', name: 'Ingram Micro' },
      { category: 'distributor', name: 'Savex Technologies' },
      { category: 'distributor', name: 'Tech Data' },
    ];

    for (const d of dropdowns) {
      await query(`INSERT INTO dropdown_options (category, name) VALUES ($1, $2)`, [d.category, d.name]);
    }

    // Seed Accounts (Customers)
    const acc1 = await query(`
      INSERT INTO accounts (name, industry, phone, email, comments, contacts)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [
      'TechCorp Global India Pvt Ltd',
      'Information Technology',
      '+91 98200 12345',
      'procurement@techcorp-global.com',
      'Tier 1 Strategic Enterprise Customer',
      JSON.stringify([
        { name: 'Ramesh Sundaram', phone: '+91 98200 12345', email: 'ramesh.s@techcorp-global.com', designation: 'VP Technology' },
        { name: 'Pooja Hegde', phone: '+91 98200 67890', email: 'pooja.h@techcorp-global.com', designation: 'IT Procurement Lead' }
      ])
    ]);

    const acc2 = await query(`
      INSERT INTO accounts (name, industry, phone, email, comments, contacts)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [
      'Zenith Healthcare Systems',
      'Healthcare & Pharma',
      '+91 98110 54321',
      'vendor-desk@zenithhealth.org',
      'Hospital network upgrade project in progress',
      JSON.stringify([
        { name: 'Dr. Alok Nath', phone: '+91 98110 54321', email: 'alok.n@zenithhealth.org', designation: 'CTO' }
      ])
    ]);

    const defaultApprovers = {
      "1": u1.rows[0].id, // Finance 1
      "2": u2.rows[0].id, // Presales
      "3": u3.rows[0].id, // Management
      "4": u4.rows[0].id, // Operations
      "5": u5.rows[0].id, // Logistics
      "6": u6.rows[0].id  // Finance 2
    };

    // Seed sample cost sheet 1: Approved
    const cs1 = await query(`
      INSERT INTO cost_sheets (
        cs_number, status, subject, initiator_id, salesperson_id, account_id,
        distributor, business_unit, oem, currency, discount_type, discount_value,
        consultation_charges, freight_charges, total_purchase, total_sale,
        net_purchase, net_profit, margin_percentage, current_stage, assigned_approvers, notes, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING id
    `, [
      'SHRO/2026-27/001',
      'Approved',
      'TechCorp Campus Core Switch & Firewall Refresh',
      u7.rows[0].id,
      u7.rows[0].id,
      acc1.rows[0].id,
      'Redington India',
      'Cyber Security',
      'Fortinet',
      'INR',
      'Percentage',
      5.00, // 5% discount on purchase
      15000.00,
      8000.00,
      450000.00, // total purchase
      580000.00, // total sale
      450500.00, // net_purchase = (450000 - 22500) + 15000 + 8000 = 450500
      129500.00, // profit = 580000 - 450500 = 129500
      22.33,     // margin = (129500 / 580000) * 100 = 22.33%
      7,         // All 6 stages passed
      JSON.stringify(defaultApprovers),
      'Enterprise renewal with FortiGate 200F and FortiSwitch redundancy.',
      new Date(Date.now() - 15 * 86400000)
    ]);

    // Line items for cs1
    await query(`
      INSERT INTO line_items (cost_sheet_id, description, unit_purchase, unit_sale, quantity, total_purchase, total_sale, margin_percentage)
      VALUES 
      ($1, 'FortiGate 200F Next-Gen Firewall (High Availability Pair)', 150000, 195000, 2, 300000, 390000, 23.08),
      ($1, 'FortiSwitch 424E-FPOE Managed L3 Switch', 50000, 65000, 2, 100000, 130000, 23.08),
      ($1, '1 Year 24x7 Unified Threat Protection Support', 50000, 60000, 1, 50000, 60000, 16.67)
    `, [cs1.rows[0].id]);

    // Approval logs for cs1 (all 6 stages approved)
    const stages = [
      { name: 'Finance 1', num: 1, actor: u1.rows[0].id, comment: 'Margin and credit terms validated.' },
      { name: 'Presales', num: 2, actor: u2.rows[0].id, comment: 'BOM and hardware compatibility approved.' },
      { name: 'Management', num: 3, actor: u3.rows[0].id, comment: 'Strategic customer profitability agreed.' },
      { name: 'Operations', num: 4, actor: u4.rows[0].id, comment: 'Delivery timetable and engineer availability verified.' },
      { name: 'Logistics', num: 5, actor: u5.rows[0].id, comment: 'Freight route and warehouse stock verified.' },
      { name: 'Finance 2', num: 6, actor: u6.rows[0].id, comment: 'Final PO checklist completed. Ready for billing.' }
    ];

    for (const s of stages) {
      await query(`
        INSERT INTO approval_logs (cost_sheet_id, stage_name, stage_number, actor_id, decision, comment, timestamp)
        VALUES ($1, $2, $3, $4, 'Approved', $5, $6)
      `, [cs1.rows[0].id, s.name, s.num, s.actor, s.comment, new Date(Date.now() - (12 - s.num) * 86400000)]);
    }

    // Seed sample cost sheet 2: Pending at Stage 3 (Management)
    const cs2 = await query(`
      INSERT INTO cost_sheets (
        cs_number, status, subject, initiator_id, salesperson_id, account_id,
        distributor, business_unit, oem, currency, discount_type, discount_value,
        consultation_charges, freight_charges, total_purchase, total_sale,
        net_purchase, net_profit, margin_percentage, current_stage, assigned_approvers, notes, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING id
    `, [
      'SHRO/2026-27/002',
      'Pending',
      'Zenith Healthcare Server Virtualization Cluster',
      u7.rows[0].id,
      u7.rows[0].id,
      acc2.rows[0].id,
      'Ingram Micro',
      'Data Center Solutions',
      'Dell Technologies',
      'INR',
      'Value',
      25000.00, // 25,000 fixed discount
      20000.00,
      12000.00,
      850000.00, // total purchase
      1050000.00, // total sale
      857000.00, // net_purchase = (850000 - 25000) + 20000 + 12000 = 857000
      193000.00, // profit = 1050000 - 857000 = 193000
      18.38,     // margin = (193000 / 1050000) * 100 = 18.38%
      3,         // Currently pending Stage 3 (Management)
      JSON.stringify(defaultApprovers),
      '3x Dell PowerEdge R760 with VMware vSphere Foundation licenses.',
      new Date(Date.now() - 3 * 86400000)
    ]);

    // Line items for cs2
    await query(`
      INSERT INTO line_items (cost_sheet_id, description, unit_purchase, unit_sale, quantity, total_purchase, total_sale, margin_percentage)
      VALUES 
      ($1, 'Dell PowerEdge R760 Server (Intel Xeon Gold, 128GB RAM, 4x 1.92TB SSD)', 250000, 310000, 3, 750000, 930000, 19.35),
      ($1, 'VMware vSphere Enterprise Plus Support (3 Nodes)', 100000, 120000, 1, 100000, 120000, 16.67)
    `, [cs2.rows[0].id]);

    // Approvals for cs2 (Stage 1 and 2 approved, waiting on stage 3)
    await query(`
      INSERT INTO approval_logs (cost_sheet_id, stage_name, stage_number, actor_id, decision, comment, timestamp)
      VALUES 
      ($1, 'Finance 1', 1, $2, 'Approved', 'Credit limit check passed for Zenith.', $3),
      ($1, 'Presales', 2, $4, 'Approved', 'Sizing calculations validated for 45 VMs.', $5)
    `, [cs2.rows[0].id, u1.rows[0].id, new Date(Date.now() - 2 * 86400000), u2.rows[0].id, new Date(Date.now() - 1 * 86400000)]);

    // Notification for Vikram (Stage 3 approver)
    await query(`
      INSERT INTO notifications (user_id, title, message, cost_sheet_id)
      VALUES ($1, 'Approval Request: Stage 3 Management', 'Cost Sheet SHRO/2026-27/002 requires your profitability approval.', $2)
    `, [u3.rows[0].id, cs2.rows[0].id]);

    console.log('Seed completed successfully with admin vaibhav.g / Shro@2026 and sample data.');
  } else {
    console.log('Database already initialized.');
  }
}

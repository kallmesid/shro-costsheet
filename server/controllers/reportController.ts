import { Response } from 'express';
import * as XLSX from 'xlsx';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';

const STAGE_NAMES: { [key: number]: string } = {
  1: 'Finance 1 (Initial Validation)',
  2: 'Presales (Technical SOW & BOM)',
  3: 'Management (Commercial Profitability)',
  4: 'Operations (Execution & Delivery)',
  5: 'Logistics (Freight & Customs)',
  6: 'Finance 2 (Final Billing & Invoicing)',
};

function buildDashboardFilter(queryObj: any, currentUserId?: number) {
  const {
    status,
    business_unit,
    salesperson_id,
    month,
    financial_year,
    account_id,
    oem,
    distributor,
    margin_band,
    quarter,
    scope,
  } = queryObj;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let pIndex = 1;

  // Scope filter: My Dashboard, My Team Dashboard, User Dashboard / All
  if (scope === 'my' && currentUserId) {
    whereClause += ` AND (cs.initiator_id = $${pIndex} OR cs.salesperson_id = $${pIndex})`;
    params.push(currentUserId);
    pIndex++;
  } else if (scope === 'team' && currentUserId) {
    whereClause += ` AND (
      cs.initiator_id IN (
        SELECT tm.user_id FROM team_members tm 
        WHERE tm.team_id IN (
          SELECT team_id FROM team_members WHERE user_id = $${pIndex}
          UNION
          SELECT id FROM teams WHERE lead_id = $${pIndex}
        )
      ) OR cs.salesperson_id IN (
        SELECT tm.user_id FROM team_members tm 
        WHERE tm.team_id IN (
          SELECT team_id FROM team_members WHERE user_id = $${pIndex}
          UNION
          SELECT id FROM teams WHERE lead_id = $${pIndex}
        )
      )
    )`;
    params.push(currentUserId);
    pIndex++;
  }

  if (status && status !== 'All') {
    whereClause += ` AND cs.status = $${pIndex++}`;
    params.push(status);
  }
  if (business_unit && business_unit !== 'All') {
    whereClause += ` AND cs.business_unit = $${pIndex++}`;
    params.push(business_unit);
  }
  if (salesperson_id && salesperson_id !== 'All') {
    whereClause += ` AND cs.salesperson_id = $${pIndex++}`;
    params.push(parseInt(salesperson_id as string, 10));
  }
  if (account_id && account_id !== 'All') {
    whereClause += ` AND cs.account_id = $${pIndex++}`;
    params.push(parseInt(account_id as string, 10));
  }
  if (oem && oem !== 'All') {
    whereClause += ` AND cs.oem = $${pIndex++}`;
    params.push(oem);
  }
  if (distributor && distributor !== 'All') {
    whereClause += ` AND cs.distributor = $${pIndex++}`;
    params.push(distributor);
  }
  if (month && month !== 'All') {
    whereClause += ` AND EXTRACT(MONTH FROM cs.created_at) = $${pIndex++}`;
    params.push(parseInt(month as string, 10));
  }
  if (quarter && quarter !== 'All') {
    if (quarter === 'Q1') {
      whereClause += ` AND EXTRACT(MONTH FROM cs.created_at) IN (4, 5, 6)`;
    } else if (quarter === 'Q2') {
      whereClause += ` AND EXTRACT(MONTH FROM cs.created_at) IN (7, 8, 9)`;
    } else if (quarter === 'Q3') {
      whereClause += ` AND EXTRACT(MONTH FROM cs.created_at) IN (10, 11, 12)`;
    } else if (quarter === 'Q4') {
      whereClause += ` AND EXTRACT(MONTH FROM cs.created_at) IN (1, 2, 3)`;
    }
  }
  if (margin_band && margin_band !== 'All') {
    if (margin_band === 'lt_10') {
      whereClause += ` AND cs.margin_percentage < 10`;
    } else if (margin_band === '10_to_18') {
      whereClause += ` AND cs.margin_percentage >= 10 AND cs.margin_percentage <= 18`;
    } else if (margin_band === 'gt_18') {
      whereClause += ` AND cs.margin_percentage > 18`;
    }
  }
  if (financial_year && financial_year !== 'All') {
    whereClause += ` AND cs.cs_number LIKE $${pIndex++}`;
    params.push(`%${financial_year}%`);
  }

  return { whereClause, params, pIndex };
}

export async function getDashboardStats(req: AuthRequest, res: Response) {
  try {
    const { whereClause, params } = buildDashboardFilter(req.query, req.user?.id);

    // Aggregate KPIs
    const kpiRes = await query(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(cs.total_sale), 0) as total_deal_value,
        COALESCE(SUM(cs.total_purchase), 0) as total_purchase,
        COALESCE(SUM(cs.net_profit), 0) as total_profit,
        COALESCE(AVG(cs.margin_percentage), 0) as avg_margin,
        COUNT(CASE WHEN cs.status = 'Draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN cs.status = 'Pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN cs.status = 'Approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN cs.status = 'Rejected' THEN 1 END) as rejected_count
      FROM cost_sheets cs
      ${whereClause}
    `, params);

    const totalDealVal = parseFloat(kpiRes.rows[0]?.total_deal_value || '0');
    const totalProf = parseFloat(kpiRes.rows[0]?.total_profit || '0');
    const overallMargin = totalDealVal > 0 ? (totalProf / totalDealVal) * 100 : 0;

    const kpis = {
      total_count: parseInt(kpiRes.rows[0]?.total_count || '0', 10),
      total_deal_value: totalDealVal,
      total_purchase: parseFloat(kpiRes.rows[0]?.total_purchase || '0'),
      total_profit: totalProf,
      avg_margin: parseFloat(parseFloat(kpiRes.rows[0]?.avg_margin || '0').toFixed(2)),
      overall_margin: parseFloat(overallMargin.toFixed(2)),
      draft_count: parseInt(kpiRes.rows[0]?.draft_count || '0', 10),
      pending_count: parseInt(kpiRes.rows[0]?.pending_count || '0', 10),
      approved_count: parseInt(kpiRes.rows[0]?.approved_count || '0', 10),
      rejected_count: parseInt(kpiRes.rows[0]?.rejected_count || '0', 10),
    };

    // Monthly Profit Trend
    const trendRes = await query(`
      SELECT 
        TO_CHAR(cs.created_at, 'Mon YYYY') as month_label,
        EXTRACT(YEAR FROM cs.created_at) as yr,
        EXTRACT(MONTH FROM cs.created_at) as mo,
        COALESCE(SUM(cs.net_profit), 0) as total_profit,
        COALESCE(SUM(cs.total_sale), 0) as total_sale,
        COUNT(cs.id) as count
      FROM cost_sheets cs
      ${whereClause}
      GROUP BY month_label, yr, mo
      ORDER BY yr ASC, mo ASC
      LIMIT 12
    `, params);

    // Salesperson Performance
    const salesRes = await query(`
      SELECT 
        u.id as salesperson_id,
        COALESCE(u.name, 'Unassigned') as salesperson_name,
        COALESCE(SUM(cs.total_sale), 0) as total_deal_value,
        COALESCE(SUM(cs.net_profit), 0) as total_profit,
        COALESCE(AVG(cs.margin_percentage), 0) as avg_margin,
        COUNT(cs.id) as deal_count
      FROM cost_sheets cs
      LEFT JOIN users u ON cs.salesperson_id = u.id
      ${whereClause}
      GROUP BY u.id, u.name
      ORDER BY total_deal_value DESC
      LIMIT 10
    `, params);

    // Status Distribution
    const statusRes = await query(`
      SELECT 
        cs.status,
        COUNT(cs.id) as count,
        COALESCE(SUM(cs.total_sale), 0) as total_sale
      FROM cost_sheets cs
      ${whereClause}
      GROUP BY cs.status
    `, params);

    // Business Unit Distribution
    const buRes = await query(`
      SELECT 
        COALESCE(NULLIF(cs.business_unit, ''), 'Other') as business_unit,
        COUNT(cs.id) as count,
        COALESCE(SUM(cs.total_sale), 0) as total_sale,
        COALESCE(SUM(cs.net_profit), 0) as total_profit
      FROM cost_sheets cs
      ${whereClause}
      GROUP BY cs.business_unit
      ORDER BY total_sale DESC
      LIMIT 8
    `, params);

    // OEM Distribution
    const oemRes = await query(`
      SELECT 
        COALESCE(NULLIF(cs.oem, ''), 'Other') as oem,
        COUNT(cs.id) as count,
        COALESCE(SUM(cs.total_sale), 0) as total_sale
      FROM cost_sheets cs
      ${whereClause}
      GROUP BY cs.oem
      ORDER BY total_sale DESC
      LIMIT 8
    `, params);

    // Top Customer Accounts
    const topAccountsRes = await query(`
      SELECT 
        COALESCE(acc.name, 'Direct Client') as account_name,
        COUNT(cs.id) as deal_count,
        COALESCE(SUM(cs.total_sale), 0) as total_value,
        COALESCE(SUM(cs.net_profit), 0) as total_profit,
        COALESCE(AVG(cs.margin_percentage), 0) as avg_margin
      FROM cost_sheets cs
      LEFT JOIN accounts acc ON cs.account_id = acc.id
      ${whereClause}
      GROUP BY acc.name
      ORDER BY total_value DESC
      LIMIT 8
    `, params);

    // Performance by User (Comprehensive across Sales, Initiator, and Approval responsibilities)
    const userPerfRes = await query(`
      WITH filtered_cs AS (
        SELECT * FROM cost_sheets cs
        ${whereClause}
      )
      SELECT 
        u.id as user_id,
        u.name as user_name,
        COALESCE(u.role, 'Sales') as dept_role,
        u.access_level,
        COUNT(fcs.id) as total_count,
        COUNT(CASE WHEN fcs.status = 'Draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN fcs.status = 'Pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN fcs.status = 'Approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN fcs.status = 'Rejected' THEN 1 END) as rejected_count,
        COALESCE(SUM(fcs.total_sale), 0) as total_sale,
        COALESCE(SUM(fcs.net_profit), 0) as total_profit,
        COALESCE(AVG(fcs.margin_percentage), 0) as avg_margin,
        COALESCE((
          SELECT COUNT(p.id) 
          FROM cost_sheets p 
          WHERE p.status = 'Pending' 
            AND (p.assigned_approvers->>p.current_stage::text)::int = u.id
        ), 0) as awaiting_approval_count
      FROM users u
      LEFT JOIN filtered_cs fcs ON (fcs.salesperson_id = u.id OR fcs.initiator_id = u.id)
      WHERE u.status = 'Active'
      GROUP BY u.id, u.name, u.role, u.access_level
      ORDER BY total_sale DESC, total_count DESC
    `, params);

    // Recent Cost Sheets with all fields
    const recentRes = await query(`
      SELECT cs.id, cs.cs_number, cs.subject, cs.status, cs.current_stage,
             cs.total_sale, cs.total_purchase, cs.net_profit, cs.margin_percentage, 
             cs.oem, cs.distributor, cs.business_unit, cs.created_at,
             acc.name as account_name, u.name as salesperson_name
      FROM cost_sheets cs
      LEFT JOIN accounts acc ON cs.account_id = acc.id
      LEFT JOIN users u ON cs.salesperson_id = u.id
      ${whereClause}
      ORDER BY cs.created_at DESC
      LIMIT 10
    `, params);

    return res.json({
      kpis,
      monthly_trend: trendRes.rows,
      salesperson_performance: salesRes.rows,
      status_distribution: statusRes.rows,
      business_unit_distribution: buRes.rows,
      oem_distribution: oemRes.rows,
      top_accounts: topAccountsRes.rows,
      user_performance: userPerfRes.rows,
      recent_sheets: recentRes.rows
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
}

// In-Depth Insights Drilldown endpoint for all dashboard panels
export async function getDrilldownInsights(req: AuthRequest, res: Response) {
  try {
    const { panel, target_id, target_name } = req.query;
    const { whereClause, params } = buildDashboardFilter(req.query, req.user?.id);

    let specificWhere = whereClause;
    const specificParams = [...params];
    let nextIndex = specificParams.length + 1;

    // Default sheets query
    let sheetsOrderBy = 'cs.created_at DESC';

    // Panel customization
    if (panel === 'pending_approvals') {
      specificWhere += ` AND cs.status = 'Pending'`;
      sheetsOrderBy = 'cs.current_stage ASC, cs.created_at ASC';
    } else if (panel === 'approved_deals') {
      specificWhere += ` AND cs.status = 'Approved'`;
      sheetsOrderBy = 'cs.total_sale DESC';
    } else if (panel === 'draft_deals') {
      specificWhere += ` AND cs.status = 'Draft'`;
      sheetsOrderBy = 'cs.created_at DESC';
    } else if (panel === 'rejected_deals') {
      specificWhere += ` AND cs.status = 'Rejected'`;
      sheetsOrderBy = 'cs.created_at DESC';
    } else if (panel === 'gross_deal_value') {
      sheetsOrderBy = 'cs.total_sale DESC';
    } else if (panel === 'net_profit') {
      sheetsOrderBy = 'cs.net_profit DESC';
    } else if (panel === 'average_margin') {
      sheetsOrderBy = 'cs.margin_percentage ASC'; // show critical margins first
    } else if (panel === 'business_unit_distribution' && target_name && target_name !== 'All') {
      specificWhere += ` AND cs.business_unit = $${nextIndex++}`;
      specificParams.push(target_name);
      sheetsOrderBy = 'cs.total_sale DESC';
    } else if (panel === 'user_performance' && target_id && target_id !== 'All') {
      specificWhere += ` AND (cs.salesperson_id = $${nextIndex} OR cs.initiator_id = $${nextIndex})`;
      specificParams.push(parseInt(target_id as string, 10));
      nextIndex++;
      sheetsOrderBy = 'cs.created_at DESC';
    } else if (panel === 'oem_distribution' && target_name && target_name !== 'All') {
      specificWhere += ` AND cs.oem = $${nextIndex++}`;
      specificParams.push(target_name);
      sheetsOrderBy = 'cs.total_sale DESC';
    } else if (panel === 'salesperson_performance' && target_id && target_id !== 'All') {
      specificWhere += ` AND cs.salesperson_id = $${nextIndex++}`;
      specificParams.push(parseInt(target_id as string, 10));
      sheetsOrderBy = 'cs.created_at DESC';
    } else if (panel === 'top_accounts' && target_name && target_name !== 'All') {
      specificWhere += ` AND acc.name = $${nextIndex++}`;
      specificParams.push(target_name);
      sheetsOrderBy = 'cs.total_sale DESC';
    } else if (panel === 'monthly_trend' && target_name && target_name !== 'All') {
      specificWhere += ` AND EXTRACT(MONTH FROM cs.created_at) = $${nextIndex++}`;
      specificParams.push(parseInt(target_name as string, 10));
      sheetsOrderBy = 'cs.total_sale DESC';
    }

    // 1. Fetch matching cost sheets for drilldown table
    const sheetsRes = await query(`
      SELECT cs.id, cs.cs_number, cs.subject, cs.status, cs.current_stage,
             cs.total_sale, cs.total_purchase, cs.net_profit, cs.margin_percentage,
             cs.discount_type, cs.discount_value,
             cs.oem, cs.distributor, cs.business_unit, cs.created_at,
             acc.name as account_name, u.name as salesperson_name
      FROM cost_sheets cs
      LEFT JOIN accounts acc ON cs.account_id = acc.id
      LEFT JOIN users u ON cs.salesperson_id = u.id
      ${specificWhere}
      ORDER BY ${sheetsOrderBy}
      LIMIT 100
    `, specificParams);

    const sheets = sheetsRes.rows;

    // 2. Fetch panel-specific deep aggregates
    let insightsData: any = {};

    if (panel === 'gross_deal_value') {
      const buRes = await query(`
        SELECT cs.business_unit, 
               COUNT(cs.id) as count, 
               COALESCE(SUM(cs.total_sale), 0) as total_sale,
               COALESCE(AVG(cs.margin_percentage), 0) as avg_margin
        FROM cost_sheets cs
        ${whereClause}
        GROUP BY cs.business_unit
        ORDER BY total_sale DESC
      `, params);

      const oemRes = await query(`
        SELECT COALESCE(NULLIF(cs.oem, ''), 'Other') as oem, 
               COUNT(cs.id) as count, 
               COALESCE(SUM(cs.total_sale), 0) as total_sale
        FROM cost_sheets cs
        ${whereClause}
        GROUP BY cs.oem
        ORDER BY total_sale DESC
        LIMIT 6
      `, params);

      insightsData = {
        title: 'Gross Deal Value & Revenue Composition',
        subtitle: 'Comprehensive analysis of top-line revenue velocity, procurement cost absorption, and business unit splits.',
        bu_breakdown: buRes.rows,
        oem_breakdown: oemRes.rows,
      };
    } else if (panel === 'net_profit') {
      const tierRes = await query(`
        SELECT 
          CASE 
            WHEN cs.margin_percentage >= 18 THEN 'Healthy (> 18%)'
            WHEN cs.margin_percentage >= 10 THEN 'Standard (10% - 18%)'
            ELSE 'Thin (< 10%)'
          END as tier,
          COUNT(cs.id) as count,
          COALESCE(SUM(cs.net_profit), 0) as total_profit,
          COALESCE(SUM(cs.total_sale), 0) as total_sale
        FROM cost_sheets cs
        ${whereClause}
        GROUP BY tier
        ORDER BY total_profit DESC
      `, params);

      insightsData = {
        title: 'Net Profit & Deal Yield Analysis',
        subtitle: 'Bottom-line profitability metrics, margin health tiers, and high-yield transaction drivers.',
        tiers: tierRes.rows,
      };
    } else if (panel === 'average_margin') {
      const marginDistRes = await query(`
        SELECT 
          CASE 
            WHEN cs.margin_percentage < 10 THEN '< 10% (Alert Tier)'
            WHEN cs.margin_percentage < 15 THEN '10% - 15% (Competitive)'
            WHEN cs.margin_percentage < 20 THEN '15% - 20% (Standard)'
            ELSE '> 20% (Premium)'
          END as bracket,
          COUNT(cs.id) as count,
          COALESCE(SUM(cs.total_sale), 0) as total_sale,
          COALESCE(AVG(cs.margin_percentage), 0) as avg_margin
        FROM cost_sheets cs
        ${whereClause}
        GROUP BY bracket
        ORDER BY avg_margin ASC
      `, params);

      const buMarginRes = await query(`
        SELECT cs.business_unit, 
               COALESCE(AVG(cs.margin_percentage), 0) as avg_margin,
               COUNT(cs.id) as count
        FROM cost_sheets cs
        ${whereClause}
        GROUP BY cs.business_unit
        ORDER BY avg_margin DESC
      `, params);

      insightsData = {
        title: 'Gross Margin & Profitability Health',
        subtitle: 'Distribution of gross yield across quotations and identifying discount pressure points.',
        brackets: marginDistRes.rows,
        bu_margins: buMarginRes.rows,
      };
    } else if (panel === 'pending_approvals') {
      const stageRes = await query(`
        SELECT cs.current_stage,
               COUNT(cs.id) as count,
               COALESCE(SUM(cs.total_sale), 0) as total_sale,
               COALESCE(SUM(cs.net_profit), 0) as total_profit
        FROM cost_sheets cs
        ${whereClause} AND cs.status = 'Pending'
        GROUP BY cs.current_stage
        ORDER BY cs.current_stage ASC
      `, params);

      const mappedStages = stageRes.rows.map(r => ({
        stage: parseInt(r.current_stage, 10),
        stage_name: STAGE_NAMES[parseInt(r.current_stage, 10)] || `Stage ${r.current_stage}`,
        count: parseInt(r.count, 10),
        total_sale: parseFloat(r.total_sale),
        total_profit: parseFloat(r.total_profit)
      }));

      insightsData = {
        title: 'Sequential Approval Pipeline & Stage Bottlenecks',
        subtitle: 'Audit of quotations currently awaiting sign-off across each of the 6 sequential approval gates.',
        stages: mappedStages,
      };
    } else if (panel === 'approved_deals') {
      const approvedMonthRes = await query(`
        SELECT TO_CHAR(cs.created_at, 'Mon YYYY') as month_label,
               COUNT(cs.id) as count,
               COALESCE(SUM(cs.total_sale), 0) as total_sale,
               COALESCE(SUM(cs.net_profit), 0) as total_profit,
               COALESCE(AVG(cs.margin_percentage), 0) as avg_margin
        FROM cost_sheets cs
        ${whereClause} AND cs.status = 'Approved'
        GROUP BY month_label, EXTRACT(YEAR FROM cs.created_at), EXTRACT(MONTH FROM cs.created_at)
        ORDER BY EXTRACT(YEAR FROM cs.created_at) ASC, EXTRACT(MONTH FROM cs.created_at) ASC
      `, params);

      insightsData = {
        title: 'Approved Quotations & Commercial Sign-off',
        subtitle: 'Fully cleared cost sheets ready for purchase order processing and customer delivery.',
        monthly: approvedMonthRes.rows,
      };
    } else if (panel === 'monthly_trend') {
      const monthlyFullRes = await query(`
        SELECT 
          TO_CHAR(cs.created_at, 'Mon YYYY') as month_label,
          EXTRACT(MONTH FROM cs.created_at) as mo,
          EXTRACT(YEAR FROM cs.created_at) as yr,
          COUNT(cs.id) as count,
          COALESCE(SUM(cs.total_sale), 0) as total_sale,
          COALESCE(SUM(cs.net_profit), 0) as total_profit,
          COALESCE(AVG(cs.margin_percentage), 0) as avg_margin
        FROM cost_sheets cs
        ${whereClause}
        GROUP BY month_label, yr, mo
        ORDER BY yr ASC, mo ASC
      `, params);

      insightsData = {
        title: 'Monthly Revenue, Profit & Velocity Trends',
        subtitle: 'Historical pipeline velocity, seasonal spikes, and revenue predictability over time.',
        trend_table: monthlyFullRes.rows,
      };
    } else if (panel === 'status_distribution') {
      const fullStatusRes = await query(`
        SELECT cs.status,
               COUNT(cs.id) as count,
               COALESCE(SUM(cs.total_sale), 0) as total_sale,
               COALESCE(SUM(cs.net_profit), 0) as total_profit,
               COALESCE(AVG(cs.margin_percentage), 0) as avg_margin
        FROM cost_sheets cs
        ${whereClause}
        GROUP BY cs.status
      `, params);

      insightsData = {
        title: 'Quotation Workflow Funnel & Conversion Health',
        subtitle: 'Pipeline conversion efficiency from Draft creation to full multi-stage approval.',
        status_table: fullStatusRes.rows,
      };
    } else if (panel === 'oem_distribution') {
      const oemFullRes = await query(`
        SELECT 
          COALESCE(NULLIF(cs.oem, ''), 'Other') as oem,
          COUNT(cs.id) as count,
          COALESCE(SUM(cs.total_sale), 0) as total_sale,
          COALESCE(SUM(cs.net_profit), 0) as total_profit,
          COALESCE(AVG(cs.margin_percentage), 0) as avg_margin
        FROM cost_sheets cs
        ${whereClause}
        GROUP BY cs.oem
        ORDER BY total_sale DESC
      `, params);

      insightsData = {
        title: 'OEM Brand Revenue & Vendor Product Portfolio',
        subtitle: 'Performance, transaction frequency, and profitability margins across hardware and software brands.',
        oem_matrix: oemFullRes.rows,
      };
    } else if (panel === 'salesperson_performance') {
      const repMatrixRes = await query(`
        SELECT 
          u.id as salesperson_id,
          COALESCE(u.name, 'Unassigned') as salesperson_name,
          COUNT(cs.id) as total_deals,
          COUNT(CASE WHEN cs.status = 'Approved' THEN 1 END) as approved_deals,
          COUNT(CASE WHEN cs.status = 'Pending' THEN 1 END) as pending_deals,
          COALESCE(SUM(cs.total_sale), 0) as total_deal_value,
          COALESCE(SUM(cs.net_profit), 0) as total_profit,
          COALESCE(AVG(cs.margin_percentage), 0) as avg_margin
        FROM cost_sheets cs
        LEFT JOIN users u ON cs.salesperson_id = u.id
        ${whereClause}
        GROUP BY u.id, u.name
        ORDER BY total_deal_value DESC
      `, params);

      insightsData = {
        title: 'Sales Representative Performance & Leaderboard',
        subtitle: 'Deal generation, approval progression, and profit contribution per executive.',
        rep_matrix: repMatrixRes.rows,
      };
    } else if (panel === 'draft_deals') {
      insightsData = {
        title: 'Draft Cost Sheets Directory',
        subtitle: 'Unsubmitted quotes currently in progress by sales representatives before formal workflow submission.',
      };
    } else if (panel === 'rejected_deals') {
      insightsData = {
        title: 'Rejected Quotations & Commercial Review Log',
        subtitle: 'Quotes that were rejected during sequential validation, along with margin and reason records.',
      };
    } else if (panel === 'business_unit_distribution') {
      const buFullRes = await query(`
        SELECT 
          COALESCE(NULLIF(cs.business_unit, ''), 'Other') as business_unit,
          COUNT(cs.id) as count,
          COALESCE(SUM(cs.total_sale), 0) as total_sale,
          COALESCE(SUM(cs.net_profit), 0) as total_profit,
          COALESCE(AVG(cs.margin_percentage), 0) as avg_margin
        FROM cost_sheets cs
        ${whereClause}
        GROUP BY cs.business_unit
        ORDER BY total_sale DESC
      `, params);

      insightsData = {
        title: 'Business Unit Revenue & Margin Contribution',
        subtitle: 'Comprehensive financial performance across organizational business divisions.',
        bu_matrix: buFullRes.rows,
      };
    } else if (panel === 'user_performance') {
      insightsData = {
        title: target_name ? `Performance Dossier: ${target_name}` : 'Individual User Performance & Workflow Queue',
        subtitle: 'Cost sheets created, total revenue yield, profit contribution, and pending workflow sign-off queue.',
      };
    } else if (panel === 'top_accounts') {
      const accountMatrixRes = await query(`
        SELECT 
          COALESCE(acc.name, 'Direct Client') as account_name,
          COUNT(cs.id) as deal_count,
          COALESCE(SUM(cs.total_sale), 0) as total_value,
          COALESCE(SUM(cs.net_profit), 0) as total_profit,
          COALESCE(AVG(cs.margin_percentage), 0) as avg_margin,
          COUNT(CASE WHEN cs.status = 'Approved' THEN 1 END) as approved_count
        FROM cost_sheets cs
        LEFT JOIN accounts acc ON cs.account_id = acc.id
        ${whereClause}
        GROUP BY acc.name
        ORDER BY total_value DESC
        LIMIT 15
      `, params);

      insightsData = {
        title: 'Enterprise Accounts & Key Client Portfolio',
        subtitle: 'Client revenue concentration, deal frequency, and relationship yield analysis.',
        account_matrix: accountMatrixRes.rows,
      };
    } else {
      insightsData = {
        title: 'Quotations Directory & Active Pipeline',
        subtitle: 'Real-time record of all quotation cost sheets matching your active scope and filters.',
      };
    }

    // 3. Synthesize smart analytical observations
    const insightsBulletPoints: string[] = [];
    const totalSaleSum = sheets.reduce((acc, s) => acc + (parseFloat(s.total_sale) || 0), 0);
    const totalProfitSum = sheets.reduce((acc, s) => acc + (parseFloat(s.net_profit) || 0), 0);
    const avgMarginCalc = totalSaleSum > 0 ? (totalProfitSum / totalSaleSum) * 100 : 0;

    if (panel === 'pending_approvals') {
      insightsBulletPoints.push(`${sheets.length} quotation(s) are currently undergoing review, representing ₹${Math.round(totalSaleSum).toLocaleString('en-IN')} in pending pipeline.`);
      const st3 = sheets.filter(s => s.current_stage === 3);
      if (st3.length > 0) {
        insightsBulletPoints.push(`Stage 3 (Management Sign-off) holds ${st3.length} quote(s) awaiting margin validation.`);
      }
      insightsBulletPoints.push('Click any cost sheet below to jump directly into its sequential sign-off panel.');
    } else if (panel === 'net_profit' || panel === 'average_margin') {
      const thinDeals = sheets.filter(s => (parseFloat(s.margin_percentage) || 0) < 10);
      if (thinDeals.length > 0) {
        insightsBulletPoints.push(`${thinDeals.length} quote(s) have margin < 10%. These require special management sign-off.`);
      }
      insightsBulletPoints.push(`Aggregate net profitability stands at ${avgMarginCalc.toFixed(2)}%, delivering ₹${Math.round(totalProfitSum).toLocaleString('en-IN')} net earnings.`);
      const topDeal = sheets[0];
      if (topDeal) {
        insightsBulletPoints.push(`Highest value deal in view is ${topDeal.cs_number} (${topDeal.account_name || 'Client'}) at ₹${Math.round(parseFloat(topDeal.total_sale)).toLocaleString('en-IN')}.`);
      }
    } else {
      insightsBulletPoints.push(`Displaying ${sheets.length} cost sheet record(s) with a combined value of ₹${Math.round(totalSaleSum).toLocaleString('en-IN')}.`);
      insightsBulletPoints.push(`Overall profit realization rate is ${avgMarginCalc.toFixed(1)}% across this slice.`);
      if (sheets.length > 0) {
        insightsBulletPoints.push(`Active records span ${Array.from(new Set(sheets.map(s => s.oem).filter(Boolean))).length} distinct OEM brand(s).`);
      }
    }

    return res.json({
      panel,
      ...insightsData,
      total_count: sheets.length,
      total_sale: totalSaleSum,
      total_profit: totalProfitSum,
      avg_margin: avgMarginCalc,
      insights_bullets: insightsBulletPoints,
      sheets
    });

  } catch (error) {
    console.error('Error fetching drilldown insights:', error);
    return res.status(500).json({ error: 'Failed to fetch drilldown insights' });
  }
}

export async function exportReportsExcel(req: AuthRequest, res: Response) {
  try {
    const { whereClause, params } = buildDashboardFilter(req.query, req.user?.id);

    const dataRes = await query(`
      SELECT cs.cs_number, cs.subject, cs.status, cs.current_stage,
             acc.name as account_name,
             u_sale.name as salesperson_name,
             cs.business_unit, cs.oem, cs.distributor, cs.currency,
             cs.total_purchase, cs.discount_type, cs.discount_value,
             cs.consultation_charges, cs.freight_charges,
             cs.net_purchase, cs.total_sale, cs.net_profit, cs.margin_percentage,
             cs.created_at
      FROM cost_sheets cs
      LEFT JOIN accounts acc ON cs.account_id = acc.id
      LEFT JOIN users u_sale ON cs.salesperson_id = u_sale.id
      ${whereClause}
      ORDER BY cs.created_at DESC
    `, params);

    // Format data rows for spreadsheet
    const rows = dataRes.rows.map(item => ({
      'Cost Sheet No': item.cs_number,
      'Deal Subject': item.subject,
      'Customer Account': item.account_name || 'N/A',
      'Salesperson': item.salesperson_name || 'N/A',
      'Status': item.status,
      'Current Stage': item.status === 'Approved' ? 'Completed' : `Stage ${item.current_stage}`,
      'Business Unit': item.business_unit || 'N/A',
      'OEM': item.oem || 'N/A',
      'Distributor': item.distributor || 'N/A',
      'Currency': item.currency,
      'Total Purchase': Number(item.total_purchase),
      'Discount Type': item.discount_type,
      'Discount Value': Number(item.discount_value),
      'Consultation Charges': Number(item.consultation_charges),
      'Freight Charges': Number(item.freight_charges),
      'Net Purchase': Number(item.net_purchase),
      'Total Sale (Deal Value)': Number(item.total_sale),
      'Net Profit': Number(item.net_profit),
      'Margin %': Number(item.margin_percentage),
      'Created Date': new Date(item.created_at).toLocaleDateString('en-GB')
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Sheets');

    worksheet['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 18 }));

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="SHRO_Cost_Sheets_Report_${Date.now()}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error exporting Excel report:', error);
    return res.status(500).json({ error: 'Failed to generate Excel report' });
  }
}

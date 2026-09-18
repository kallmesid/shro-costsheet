export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  access_level: 'Admin' | 'Management' | 'TeamLead' | 'User';
  status: 'Active' | 'Suspended' | 'Hold';
  report_to_id?: number | null;
  report_to_name?: string | null;
  created_at?: string;
  is_sudo?: boolean;
  original_admin_id?: number;
}

export interface AccountContact {
  name: string;
  phone?: string;
  email?: string;
  designation?: string;
}

export interface Account {
  id: number;
  name: string;
  industry?: string;
  phone?: string;
  email?: string;
  comments?: string;
  contacts?: AccountContact[];
  created_at?: string;
}

export interface LineItem {
  id?: number;
  cost_sheet_id?: number;
  description: string;
  unit_purchase: number;
  unit_sale: number;
  quantity: number;
  total_purchase: number;
  total_sale: number;
  margin_percentage: number;
  uom?: string;
  margin_value?: number;
  sub_total?: number;
  tax_description?: string;
  total?: number;
}

export interface ApprovalLog {
  id: number;
  cost_sheet_id: number;
  stage_name: string;
  stage_number: number;
  actor_id: number;
  actor_name?: string;
  actor_role?: string;
  decision: 'Approved' | 'Rejected';
  comment?: string;
  timestamp: string;
}

export interface UploadedFile {
  id: number;
  cost_sheet_id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  uploaded_at: string;
}

export interface CostSheet {
  id: number;
  cs_number: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  subject: string;
  initiator_id: number;
  initiator_name?: string;
  initiator_email?: string;
  salesperson_id: number;
  salesperson_name?: string;
  salesperson_email?: string;
  account_id?: number;
  account_name?: string;
  account_industry?: string;
  account_phone?: string;
  account_email?: string;
  account_contacts?: AccountContact[];
  distributor?: string;
  business_unit?: string;
  oem?: string;
  currency: string;
  discount_type: 'Percentage' | 'Value' | 'none';
  discount_value: number;
  consultation_charges: number;
  freight_charges: number;
  total_purchase: number;
  total_sale: number;
  net_purchase: number;
  net_profit: number;
  margin_percentage: number;
  current_stage: number; // 1 to 6, or 7 for finished
  assigned_approvers: { [stageNumber: string]: number };
  notes?: string;
  created_at: string;
  updated_at: string;
  line_items?: LineItem[];
  approval_logs?: ApprovalLog[];
  files?: UploadedFile[];
  can_user_approve?: boolean;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  cost_sheet_id?: number;
  cs_number?: string;
  is_read: boolean;
  created_at: string;
}

export interface Team {
  id: number;
  name: string;
  lead_id?: number;
  lead_name?: string;
  member_count?: number;
  members?: { team_id: number; user_id: number; name: string; role: string; access_level: string }[];
}

export interface DropdownOptions {
  business_unit: string[];
  oem: string[];
  distributor: string[];
}

export interface Company {
  id: string;
  company_name: string;
  company_size: string | null;
  company_desc: string | null;
  company_categories: string | null;
  company_location: string | null;
  company_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CompanyInsert {
  company_name: string;
  company_size?: string | null;
  company_desc?: string | null;
  company_categories?: string | null;
  company_location?: string | null;
  company_url?: string | null;
}

import { query } from '../client';
import type { Company, CompanyInsert } from '../models/company';

const TABLE = 'companies';

const COLS =
  'id, company_name, company_size, company_desc, company_categories, company_location, company_url, created_at, updated_at';

export async function createCompany(data: CompanyInsert): Promise<Company> {
  const { rows } = await query<Company>(
    `INSERT INTO ${TABLE} (company_name, company_size, company_desc, company_categories, company_location, company_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLS}`,
    [
      data.company_name,
      data.company_size ?? null,
      data.company_desc ?? null,
      data.company_categories ?? null,
      data.company_location ?? null,
      data.company_url ?? null,
    ]
  );
  return rows[0]!;
}

export async function findCompanyById(id: string): Promise<Company | null> {
  const { rows } = await query<Company>(`SELECT ${COLS} FROM ${TABLE} WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findCompanyByName(companyName: string): Promise<Company | null> {
  const { rows } = await query<Company>(`SELECT ${COLS} FROM ${TABLE} WHERE company_name = $1`, [
    companyName,
  ]);
  return rows[0] ?? null;
}

export async function listCompanies(): Promise<Company[]> {
  const { rows } = await query<Company>(`SELECT ${COLS} FROM ${TABLE} ORDER BY company_name`);
  return rows;
}

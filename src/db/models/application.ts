export interface ApplicationLogEntry {
  role: 'company' | 'user';
  subject?: string;
  body?: string;
  at?: string;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  logs: ApplicationLogEntry[];
  created_at: Date;
  updated_at: Date;
}

export interface ApplicationInsert {
  user_id: string;
  job_id: string;
  logs?: ApplicationLogEntry[];
}

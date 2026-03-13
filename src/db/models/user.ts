export interface User {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserInsert {
  email: string;
}

export interface UserUpdate {
  email?: string;
  updated_at?: Date;
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      emailAccountId: string;
    }
  }
}

export {};

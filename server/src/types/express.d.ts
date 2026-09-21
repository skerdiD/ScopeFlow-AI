declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: number;
      username: string;
      email: string;
      supabaseUserId: string;
      isDemo: boolean;
    }

    interface Request {
      authUser?: AuthenticatedUser;
      supabaseUser?: Record<string, unknown>;
    }
  }
}

export {};

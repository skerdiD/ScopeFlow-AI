export const DEMO_EMAIL = "demo@scopeflow.ai";
export const DEMO_PASSWORD = "Demo123456!";

export function isDemoEmail(email?: string | null) {
  return email?.trim().toLowerCase() === DEMO_EMAIL;
}

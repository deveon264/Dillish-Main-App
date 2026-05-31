export const ADMIN_EMAIL = "6ixbelowna@gmail.com";

export function isAdminEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL;
}

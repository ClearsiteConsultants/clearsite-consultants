export function isAdminSession(sessionEmail?: string | null) {
  const allowList = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!sessionEmail) {
    return false;
  }

  return allowList.includes(sessionEmail.toLowerCase());
}

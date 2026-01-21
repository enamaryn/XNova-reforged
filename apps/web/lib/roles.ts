export type UserRole = "PLAYER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

export function normalizeRole(role?: string | null) {
  return role ? role.toUpperCase() : null;
}

export function hasAdminAccess(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized === "ADMIN" || normalized === "SUPER_ADMIN";
}

export function isSuperAdmin(role?: string | null) {
  return normalizeRole(role) === "SUPER_ADMIN";
}

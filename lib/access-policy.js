export function ownsResource(caller, resource) {
  if (!caller || !resource) return false;
  if (caller.role === "superAdmin") return true;
  if (caller.uid && (resource.userId === caller.uid || resource.createdBy === caller.uid)) return true;
  const email = String(caller.email || "").trim().toLowerCase();
  const buyerEmail = String(resource.buyerEmail || resource.registrationData?.email || "").trim().toLowerCase();
  return Boolean(email && buyerEmail && email === buyerEmail);
}

/** Resolve a role only from a trusted profile or trusted custom claim. */
export function resolveUserRole(profile, trustedClaim = null) {
  const validRoles = new Set(["superAdmin", "organiser", "ambassador", "user"]);
  const candidate = profile ? profile.role : trustedClaim;
  return validRoles.has(candidate) ? candidate : "user";
}

export function managesEvent(caller, event) {
  if (!caller || !event) return false;
  if (caller.role === "superAdmin") return true;
  return caller.role === "organiser" && Boolean(
    (caller.uid && event.createdBy === caller.uid) ||
    (caller.organizationId && event.organizationId && caller.organizationId === event.organizationId)
  );
}

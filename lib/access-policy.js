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
  const email = String(caller.email || "").toLowerCase().trim();
  const isSuper =
    caller.role === "superAdmin" ||
    email === "adil4ticketlelo@gmail.com" ||
    email === "superadmin@ticketlelo.com";
  if (isSuper) return true;

  const uid = caller.uid || caller.id;
  const isOrganiser = caller.role === "organiser" || caller.isAdmin === true;
  if (!isOrganiser) return false;

  if (
    uid &&
    (event.createdBy === uid ||
      event.organiserId === uid ||
      event.userId === uid ||
      event.creatorId === uid)
  ) {
    return true;
  }

  if (
    caller.organizationId &&
    event.organizationId &&
    caller.organizationId === event.organizationId
  ) {
    return true;
  }

  if (email) {
    const orgEmail = String(
      event.organiserEmail || event.organizerEmail || event.email || ""
    )
      .toLowerCase()
      .trim();
    if (orgEmail && orgEmail === email) {
      return true;
    }
  }

  return false;
}

export async function verifySessionFromRequest(request) {
  const { getAuthenticatedUser } = await import("./auth-server.js");
  return getAuthenticatedUser(request);
}


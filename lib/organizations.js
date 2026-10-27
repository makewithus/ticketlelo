import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase.js";

/**
 * Multi-Tenant Organization Management Service
 * Supports organization isolation, membership, and workspace ownership (AUTH-006, P01, P04).
 */

export const createOrganization = async ({
  name,
  slug,
  logoUrl = "",
  ownerUid,
  settings = {},
}) => {
  try {
    if (!name || !ownerUid) {
      throw new Error("Organization name and ownerUid are required.");
    }

    const cleanSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const orgRef = doc(collection(db, "organizations"));
    const orgData = {
      id: orgRef.id,
      name: name.trim(),
      slug: cleanSlug,
      logoUrl,
      ownerUid,
      members: [ownerUid],
      settings: {
        currency: "INR",
        contactEmail: settings.contactEmail || "",
        contactPhone: settings.contactPhone || "",
        gstin: settings.gstin || "",
        ...settings,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(orgRef, orgData);

    // Link organizationId to user document if not already set
    try {
      const userRef = doc(db, "users", ownerUid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const existingData = userDoc.data();
        if (!existingData.organizationId) {
          await updateDoc(userRef, {
            organizationId: orgRef.id,
            role: existingData.role === "superAdmin" ? "superAdmin" : "organiser",
            updatedAt: Timestamp.now(),
          });
        }
      }
    } catch (linkErr) {
      console.warn("[organizations] Could not update user organization link:", linkErr.message);
    }

    return orgData;
  } catch (error) {
    console.error("[organizations] createOrganization error:", error.message);
    throw error;
  }
};

export const getOrganization = async (orgId) => {
  try {
    if (!orgId) return null;
    const orgDoc = await getDoc(doc(db, "organizations", orgId));
    return orgDoc.exists() ? { id: orgDoc.id, ...orgDoc.data() } : null;
  } catch (error) {
    console.error("[organizations] getOrganization error:", error.message);
    return null;
  }
};

export const getOrganizationBySlug = async (slug) => {
  try {
    if (!slug) return null;
    const q = query(
      collection(db, "organizations"),
      where("slug", "==", slug.toLowerCase().trim())
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() };
    }
    return null;
  } catch (error) {
    console.error("[organizations] getOrganizationBySlug error:", error.message);
    return null;
  }
};

export const getUserOrganizations = async (userId) => {
  try {
    if (!userId) return [];
    const q = query(
      collection(db, "organizations"),
      where("members", "array-contains", userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("[organizations] getUserOrganizations error:", error.message);
    return [];
  }
};

export const ensureDefaultOrganizationForUser = async (user) => {
  try {
    if (!user || !user.id) return null;

    // Check if user already has organizations
    const userOrgs = await getUserOrganizations(user.id);
    if (userOrgs.length > 0) {
      return userOrgs[0];
    }

    // If user document already specifies organizationId, fetch it
    if (user.organizationId) {
      const directOrg = await getOrganization(user.organizationId);
      if (directOrg) return directOrg;
    }

    // Auto-provision a default organization workspace for organizer
    const orgName = user.fullName
      ? `${user.fullName}'s Organization`
      : "Default Event Workspace";
    const slug = `org-${user.id.substring(0, 8)}`;

    return await createOrganization({
      name: orgName,
      slug,
      ownerUid: user.id,
      settings: {
        contactEmail: user.email || "",
        contactPhone: user.whatsappPhone || "",
      },
    });
  } catch (error) {
    console.error("[organizations] ensureDefaultOrganizationForUser error:", error.message);
    return null;
  }
};

export const addMemberToOrganization = async (orgId, newMemberUid, requesterUid) => {
  try {
    const org = await getOrganization(orgId);
    if (!org) throw new Error("Organization not found");

    if (org.ownerUid !== requesterUid && !org.members.includes(requesterUid)) {
      throw new Error("Unauthorized to add members to this organization");
    }

    await updateDoc(doc(db, "organizations", orgId), {
      members: arrayUnion(newMemberUid),
      updatedAt: Timestamp.now(),
    });

    return true;
  } catch (error) {
    console.error("[organizations] addMemberToOrganization error:", error.message);
    throw error;
  }
};

export const removeMemberFromOrganization = async (orgId, memberUid, requesterUid) => {
  try {
    const org = await getOrganization(orgId);
    if (!org) throw new Error("Organization not found");

    if (org.ownerUid !== requesterUid) {
      throw new Error("Only organization owner can remove members");
    }

    if (memberUid === org.ownerUid) {
      throw new Error("Cannot remove organization owner");
    }

    await updateDoc(doc(db, "organizations", orgId), {
      members: arrayRemove(memberUid),
      updatedAt: Timestamp.now(),
    });

    return true;
  } catch (error) {
    console.error("[organizations] removeMemberFromOrganization error:", error.message);
    throw error;
  }
};

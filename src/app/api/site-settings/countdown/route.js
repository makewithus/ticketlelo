import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

const SETTINGS_REF = () => adminDb.collection("siteSettings").doc("homepage");
const DEFAULT_COUNTDOWN_AT = "2026-11-04T18:30:00+05:30";

const DEFAULT_SITE_CONFIG = {
  platformName: "TicketLelo",
  supportEmail: "support@ticketlelo.com",
  serviceFeePercent: "2.5",
  maintenanceMode: false,
  publicDiscovery: true,
};

export async function GET() {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({
        countdownAt: DEFAULT_COUNTDOWN_AT,
        siteConfig: DEFAULT_SITE_CONFIG,
        updatedAt: null,
      });
    }

    const snapshot = await SETTINGS_REF().get();
    const data = snapshot.exists ? snapshot.data() : {};
    const stored = data?.countdownAt;
    const updatedAt = data?.updatedAt || null;

    const siteConfig = {
      platformName: data?.siteConfig?.platformName || data?.platformName || DEFAULT_SITE_CONFIG.platformName,
      supportEmail: data?.siteConfig?.supportEmail || data?.supportEmail || DEFAULT_SITE_CONFIG.supportEmail,
      serviceFeePercent: String(data?.siteConfig?.serviceFeePercent || data?.serviceFeePercent || DEFAULT_SITE_CONFIG.serviceFeePercent),
      maintenanceMode: Boolean(data?.siteConfig?.maintenanceMode ?? data?.maintenanceMode ?? DEFAULT_SITE_CONFIG.maintenanceMode),
      publicDiscovery: Boolean(data?.siteConfig?.publicDiscovery ?? data?.publicDiscovery ?? DEFAULT_SITE_CONFIG.publicDiscovery),
    };

    return NextResponse.json(
      {
        countdownAt: typeof stored === "string" && !Number.isNaN(Date.parse(stored))
          ? stored
          : DEFAULT_COUNTDOWN_AT,
        siteConfig,
        updatedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to read homepage countdown setting:", error);
    return NextResponse.json({ error: "Could not load homepage settings" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Site settings are unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Sign in as a super administrator" }, { status: 401 });

    const emailLower = (caller?.email || "").toLowerCase().trim();
    const superAdminEnv = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
    const isSuperAdmin =
      caller?.role === "superAdmin" ||
      caller?.isAdmin === true ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com" ||
      (superAdminEnv && emailLower === superAdminEnv);

    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { countdownAt, siteConfig } = body;

    const nowIso = new Date().toISOString();
    const updatePayload = {
      updatedAt: nowIso,
      updatedBy: caller.uid || caller.id,
    };

    if (countdownAt && typeof countdownAt === "string" && !Number.isNaN(Date.parse(countdownAt))) {
      updatePayload.countdownAt = countdownAt;
    }

    if (siteConfig && typeof siteConfig === "object") {
      updatePayload.siteConfig = {
        platformName: typeof siteConfig.platformName === "string" ? siteConfig.platformName.trim() : DEFAULT_SITE_CONFIG.platformName,
        supportEmail: typeof siteConfig.supportEmail === "string" ? siteConfig.supportEmail.trim() : DEFAULT_SITE_CONFIG.supportEmail,
        serviceFeePercent: String(siteConfig.serviceFeePercent || DEFAULT_SITE_CONFIG.serviceFeePercent),
        maintenanceMode: Boolean(siteConfig.maintenanceMode),
        publicDiscovery: siteConfig.publicDiscovery !== false,
      };
      // Also write top-level fields for backwards compatibility
      updatePayload.platformName = updatePayload.siteConfig.platformName;
      updatePayload.supportEmail = updatePayload.siteConfig.supportEmail;
      updatePayload.serviceFeePercent = updatePayload.siteConfig.serviceFeePercent;
      updatePayload.maintenanceMode = updatePayload.siteConfig.maintenanceMode;
      updatePayload.publicDiscovery = updatePayload.siteConfig.publicDiscovery;
    }

    await SETTINGS_REF().set(updatePayload, { merge: true });

    return NextResponse.json({
      success: true,
      countdownAt: updatePayload.countdownAt || countdownAt,
      siteConfig: updatePayload.siteConfig || siteConfig,
      updatedAt: nowIso,
    });
  } catch (error) {
    console.error("Failed to update homepage countdown setting:", error);
    const status = error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Your session has expired. Sign in again." : "Could not save homepage settings" }, { status });
  }
}

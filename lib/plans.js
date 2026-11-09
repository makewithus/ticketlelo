/**
 * Plan Definitions — Single source of truth for all pricing tiers and organizer facilities.
 * Import this wherever plan enforcement and facility allocation is needed.
 */

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    tier: "START",
    price: 0,
    currency: "INR",
    eventsAllowed: 1,
    participantsPerEvent: 300,
    platformFeeRate: 5.0,
    customBranding: false,
    paymentIntegration: false,
    socialLinks: false,
    analytics: false,
    broadcastMessaging: false,
    customSlug: false,
    bannerUpload: false,
    emailSupport: false,
    prioritySupport: false,
    dedicatedManager: false,
    instantPayouts: false,
    description: "Ideal for initial trials and small college meetups.",
  },
  starter: {
    id: "starter",
    name: "Starter",
    tier: "START",
    price: 999,
    currency: "INR",
    eventsAllowed: 3,
    participantsPerEvent: 1000,
    platformFeeRate: 4.5,
    customBranding: true,
    paymentIntegration: true,
    socialLinks: true,
    analytics: true,
    broadcastMessaging: true,
    customSlug: true,
    bannerUpload: true,
    emailSupport: true,
    prioritySupport: false,
    dedicatedManager: false,
    instantPayouts: false,
    description: "Great for regular departmental events and workshops.",
  },
  pro: {
    id: "pro",
    name: "Pro (Campus)",
    tier: "CAMPUS",
    price: 2499,
    currency: "INR",
    eventsAllowed: 10,
    participantsPerEvent: -1, // unlimited
    platformFeeRate: 4.5,
    customBranding: true,
    paymentIntegration: true,
    socialLinks: true,
    analytics: true,
    broadcastMessaging: true,
    customSlug: true,
    bannerUpload: true,
    emailSupport: true,
    prioritySupport: true,
    dedicatedManager: false,
    instantPayouts: false,
    description: "Perfect for large inter-college fests and conferences.",
  },
  fest: {
    id: "fest",
    name: "Fest (Enterprise)",
    tier: "FEST",
    price: 4999,
    currency: "INR",
    eventsAllowed: -1, // unlimited
    participantsPerEvent: -1, // unlimited
    platformFeeRate: 3.5,
    customBranding: true,
    paymentIntegration: true,
    socialLinks: true,
    analytics: true,
    broadcastMessaging: true,
    customSlug: true,
    bannerUpload: true,
    emailSupport: true,
    prioritySupport: true,
    dedicatedManager: true,
    instantPayouts: true,
    description: "Full enterprise power with lowest 3.5% fee and unlimited capacity.",
  },
};

/** Plan aliases and canonical ID mapping */
export const PLAN_ALIASES = Object.freeze({
  free: "free",
  start: "starter",
  starter: "starter",
  campus: "pro",
  pro: "pro",
  fest: "fest",
  enterprise: "fest",
});

/** Metadata definitions of all organizer platform facilities */
export const FACILITY_DEFINITIONS = Object.freeze([
  {
    key: "paymentIntegration",
    label: "Razorpay Payment & Linked Account",
    description: "Sell paid tickets with Razorpay Route and direct linked-account settlement.",
    group: "finance",
    iconName: "CreditCard",
  },
  {
    key: "customBranding",
    label: "Custom Organizer Branding",
    description: "Remove TicketLelo branding and display organization logo and styling.",
    group: "branding",
    iconName: "Palette",
  },
  {
    key: "customSlug",
    label: "Custom Event URL Slug",
    description: "Personalized short links (e.g. ticketlelo.com/e/my-college-fest).",
    group: "branding",
    iconName: "Globe",
  },
  {
    key: "bannerUpload",
    label: "High-Res Banner & Media Studio",
    description: "Upload custom promotional banners, hero posters, and event galleries.",
    group: "branding",
    iconName: "Image",
  },
  {
    key: "socialLinks",
    label: "Organization Social Media Links",
    description: "Feature Instagram, LinkedIn, YouTube, and website links on event pages.",
    group: "branding",
    iconName: "Share2",
  },
  {
    key: "analytics",
    label: "Advanced Analytics & Insights",
    description: "Real-time registration tracking, ticket tiers, and attendance breakdown.",
    group: "data",
    iconName: "BarChart3",
  },
  {
    key: "broadcastMessaging",
    label: "Broadcast Messaging System",
    description: "Send direct email and WhatsApp announcements to registered attendees.",
    group: "communication",
    iconName: "Megaphone",
  },
  {
    key: "emailSupport",
    label: "Standard Email Support",
    description: "Dedicated organizer support inbox with standard SLA response.",
    group: "support",
    iconName: "Mail",
  },
  {
    key: "prioritySupport",
    label: "Priority Support SLA",
    description: "Fast-track ticket escalation to senior operations and Super Admin.",
    group: "support",
    iconName: "Zap",
  },
  {
    key: "dedicatedManager",
    label: "Dedicated Account Manager",
    description: "Personal onboarding and real-time gate management assistance.",
    group: "support",
    iconName: "Headphones",
  },
  {
    key: "instantPayouts",
    label: "Fast-Track Payout Window",
    description: "Accelerated release schedule for trusted enterprise organizers.",
    group: "finance",
    iconName: "Banknote",
  },
]);

/** Extract boolean facilities map for a given plan */
export function getFacilitiesForPlan(planId) {
  const plan = getPlan(planId);
  return {
    customBranding: Boolean(plan.customBranding),
    paymentIntegration: Boolean(plan.paymentIntegration),
    socialLinks: Boolean(plan.socialLinks),
    analytics: Boolean(plan.analytics),
    broadcastMessaging: Boolean(plan.broadcastMessaging),
    customSlug: Boolean(plan.customSlug),
    bannerUpload: Boolean(plan.bannerUpload),
    emailSupport: Boolean(plan.emailSupport),
    prioritySupport: Boolean(plan.prioritySupport),
    dedicatedManager: Boolean(plan.dedicatedManager),
    instantPayouts: Boolean(plan.instantPayouts),
  };
}

/** Get plan definition by ID or user object */
export const getPlan = (planId) => {
  if (!planId) return PLANS.free;
  if (typeof planId === "object" && planId !== null) {
    planId = planId.plan || planId.subscriptionPlan || "free";
  }
  const clean = String(planId).toLowerCase().trim();
  const canonicalId = PLAN_ALIASES[clean] || clean;
  return PLANS[canonicalId] || PLANS.free;
};

/** Check if a user has access to a specific feature/facility */
export const hasFeature = (planIdOrUser, feature) => {
  if (typeof planIdOrUser === "object" && planIdOrUser !== null) {
    if (planIdOrUser.facilities && planIdOrUser.facilities[feature] !== undefined) {
      return Boolean(planIdOrUser.facilities[feature]);
    }
    const plan = getPlan(planIdOrUser.plan || planIdOrUser.subscriptionPlan);
    return !!plan[feature];
  }
  const plan = getPlan(planIdOrUser);
  return !!plan[feature];
};

/** Check if user can create more events */
export const canCreateEvent = (planIdOrUser, currentEventCount) => {
  if (typeof planIdOrUser === "object" && planIdOrUser !== null) {
    if (planIdOrUser.eventsAllowed === -1 || planIdOrUser.customEventsAllowed === -1) return true;
    if (typeof planIdOrUser.eventsAllowed === "number") {
      return currentEventCount < planIdOrUser.eventsAllowed;
    }
  }
  const plan = getPlan(planIdOrUser);
  if (plan.eventsAllowed === -1) return true; // unlimited
  return currentEventCount < plan.eventsAllowed;
};

/** Check if event can accept more participants */
export const canAddParticipant = (planIdOrUser, currentCount) => {
  if (typeof planIdOrUser === "object" && planIdOrUser !== null) {
    if (planIdOrUser.participantsPerEvent === -1) return true;
    if (typeof planIdOrUser.participantsPerEvent === "number") {
      return currentCount < planIdOrUser.participantsPerEvent;
    }
  }
  const plan = getPlan(planIdOrUser);
  if (plan.participantsPerEvent === -1) return true; // unlimited
  return currentCount < plan.participantsPerEvent;
};

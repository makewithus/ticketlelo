/**
 * Plan Definitions — Single source of truth for all pricing tiers.
 * Import this wherever plan enforcement is needed.
 */

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    currency: "INR",
    eventsAllowed: 1,
    participantsPerEvent: 300,
    customBranding: false,
    paymentIntegration: false,
    socialLinks: false,
    analytics: false,
    broadcastMessaging: false,
    customSlug: false,
    bannerUpload: false,
    emailSupport: false,
    prioritySupport: false,
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 999,
    currency: "INR",
    eventsAllowed: 3,
    participantsPerEvent: 1000,
    customBranding: true,
    paymentIntegration: true,
    socialLinks: true,
    analytics: true,
    broadcastMessaging: true,
    customSlug: true,
    bannerUpload: true,
    emailSupport: true,
    prioritySupport: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 2499,
    currency: "INR",
    eventsAllowed: 10,
    participantsPerEvent: -1, // unlimited
    customBranding: true,
    paymentIntegration: true,
    socialLinks: true,
    analytics: true,
    broadcastMessaging: true,
    customSlug: true,
    bannerUpload: true,
    emailSupport: true,
    prioritySupport: true,
  },
};

/** Get plan definition by id */
export const getPlan = (planId) => PLANS[planId] || PLANS.free;

/** Check if a user has access to a specific feature */
export const hasFeature = (planId, feature) => {
  const plan = getPlan(planId);
  return !!plan[feature];
};

/** Check if user can create more events */
export const canCreateEvent = (planId, currentEventCount) => {
  const plan = getPlan(planId);
  return currentEventCount < plan.eventsAllowed;
};

/** Check if event can accept more participants */
export const canAddParticipant = (planId, currentCount) => {
  const plan = getPlan(planId);
  if (plan.participantsPerEvent === -1) return true; // unlimited
  return currentCount < plan.participantsPerEvent;
};

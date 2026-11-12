import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../firebase-admin.js";
import { enqueueEmail } from "../email/index.js";

/**
 * TICKETLELO CREATOR CAMPUS AMBASSADOR PROGRAM
 * Notification & Email Dispatcher (All 6 Triggers)
 */

export const NOTIFICATION_TYPES = {
  APPLICATION_SUBMITTED_ORGANIZER: "ambassador_application_submitted_organizer",
  APPLICATION_SUBMITTED_APPLICANT: "ambassador_application_submitted_applicant",
  APPLICATION_APPROVED: "ambassador_application_approved",
  APPLICATION_REJECTED: "ambassador_application_rejected",
  POINTS_AWARDED: "ambassador_points_awarded",
  REWARD_CLAIMED: "ambassador_reward_claimed",
};

/**
 * Helper to record an in-app and email delivery log in ambassadorNotifications
 */
async function recordNotificationLog({
  recipientEmail,
  recipientUserId,
  type,
  programId,
  title,
  body,
  metadata = {},
}) {
  if (!adminDb) return;
  try {
    const notifRef = adminDb.collection("ambassadorNotifications").doc();
    await notifRef.set({
      id: notifRef.id,
      recipientEmail: recipientEmail ? recipientEmail.toLowerCase().trim() : null,
      recipientUserId: recipientUserId || null,
      type,
      programId: programId || null,
      title,
      body,
      metadata,
      status: "queued",
      createdAt: Timestamp.now(),
    });
    return notifRef.id;
  } catch (err) {
    console.warn("[ambassador-notifications] Log warning:", err?.message);
    return null;
  }
}

/**
 * Safe HTML email wrapper with TicketLelo dark theme branding
 */
function buildBrandedHtml({ headline, contentHtml, ctaText = null, ctaUrl = null }) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #131517; color: #FFFFFF; margin: 0; padding: 20px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #1A1C1F; border: 1px solid #2A2D31; border-radius: 16px; padding: 32px; }
          .badge { display: inline-block; padding: 4px 10px; background-color: rgba(254, 118, 11, 0.15); border: 1px solid rgba(254, 118, 11, 0.3); border-radius: 9999px; color: #FE760B; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
          h1 { font-size: 20px; font-weight: 800; color: #FFFFFF; margin: 0 0 12px 0; }
          p { font-size: 13px; line-height: 1.6; color: #9B9EA4; margin: 0 0 16px 0; }
          .btn { display: inline-block; padding: 12px 24px; background-color: #FE760B; color: #131517; font-weight: 700; font-size: 13px; text-decoration: none; border-radius: 10px; margin-top: 8px; }
          .footer { font-size: 11px; color: #64748B; margin-top: 24px; border-top: 1px solid #2A2D31; pt: 16px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">Creator Campus Ambassador</div>
          <h1>${headline}</h1>
          ${contentHtml}
          ${ctaText && ctaUrl ? `<div style="text-align: center; margin-top: 24px;"><a href="${ctaUrl}" class="btn">${ctaText}</a></div>` : ""}
          <div class="footer">
            <p style="margin: 0;">Sent securely by TicketLelo • ticketlelo.com</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 1. Application Submitted -> Organizer Alert
 */
export async function notifyOrganizerNewApplication({ organizerEmail, organizerUid, applicantName, applicantEmail, programTitle, programId }) {
  const headline = "New Ambassador Application Received";
  const content = `
    <p>A new applicant has applied to join your Creator Campus program <strong>${programTitle}</strong>.</p>
    <p><strong>Applicant:</strong> ${applicantName}<br><strong>Email:</strong> ${applicantEmail}</p>
    <p>Log in to your organizer dashboard to review their answers, approve or decline.</p>
  `;
  const html = buildBrandedHtml({
    headline,
    contentHtml: content,
    ctaText: "Review Application",
    ctaUrl: "https://www.ticketlelo.com/admin/dashboard",
  });

  await recordNotificationLog({
    recipientEmail: organizerEmail,
    recipientUserId: organizerUid,
    type: NOTIFICATION_TYPES.APPLICATION_SUBMITTED_ORGANIZER,
    programId,
    title: headline,
    body: `${applicantName} submitted an application for ${programTitle}`,
  });

  try {
    await enqueueEmail({
      recipient: organizerEmail,
      subject: `[TicketLelo] New Ambassador Application: ${applicantName} (${programTitle})`,
      html,
      priority: "P1",
    });
  } catch (err) {
    console.warn("[notifications] Organizer email dispatch warning:", err?.message);
  }
}

/**
 * 2. Application Submitted -> Applicant Confirmation
 */
export async function notifyApplicantSubmissionReceived({ applicantEmail, applicantName, programTitle, programId }) {
  const headline = "Application Received!";
  const content = `
    <p>Hi ${applicantName},</p>
    <p>Thank you for applying to the <strong>${programTitle}</strong> Campus Ambassador program on TicketLelo.</p>
    <p>Your application is currently pending review by the program organizer. You will receive an email as soon as your application is reviewed.</p>
  `;
  const html = buildBrandedHtml({ headline, contentHtml: content });

  await recordNotificationLog({
    recipientEmail: applicantEmail,
    type: NOTIFICATION_TYPES.APPLICATION_SUBMITTED_APPLICANT,
    programId,
    title: headline,
    body: `Your application to ${programTitle} is under review.`,
  });

  try {
    await enqueueEmail({
      recipient: applicantEmail,
      subject: `[TicketLelo] Application Received: ${programTitle}`,
      html,
      priority: "P2",
    });
  } catch (err) {
    console.warn("[notifications] Applicant email dispatch warning:", err?.message);
  }
}

/**
 * 3. Application Approved -> Ambassador Welcome & Referral Code
 */
export async function notifyAmbassadorApproved({ email, name, programTitle, referralCode, referralLink, programId }) {
  const headline = "Congratulations! You're an Official Ambassador 🎉";
  const content = `
    <p>Hi ${name},</p>
    <p>Great news! Your application to join <strong>${programTitle}</strong> as a Creator Campus Ambassador has been approved!</p>
    <div style="background-color: #131517; border: 1px solid #2A2D31; border-radius: 12px; padding: 16px; margin: 16px 0; text-align: center;">
      <p style="font-size: 11px; text-transform: uppercase; color: #FE760B; font-weight: bold; margin: 0 0 6px 0;">Your Official Referral Code</p>
      <p style="font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #FFFFFF; margin: 0; font-family: monospace;">${referralCode}</p>
    </div>
    <p>Share your code or referral link with fellow students and community members to start earning points and unlocking exclusive rewards!</p>
  `;
  const html = buildBrandedHtml({
    headline,
    contentHtml: content,
    ctaText: "Open Ambassador Dashboard",
    ctaUrl: "https://www.ticketlelo.com/ambassador/dashboard",
  });

  await recordNotificationLog({
    recipientEmail: email,
    type: NOTIFICATION_TYPES.APPLICATION_APPROVED,
    programId,
    title: headline,
    body: `Welcome to ${programTitle}! Your referral code is ${referralCode}`,
    metadata: { referralCode },
  });

  try {
    await enqueueEmail({
      recipient: email,
      subject: `[TicketLelo] Welcome Ambassador! Your referral code: ${referralCode}`,
      html,
      priority: "P0",
    });
  } catch (err) {
    console.warn("[notifications] Welcome email dispatch warning:", err?.message);
  }
}

/**
 * 4. Application Rejected -> Applicant Notification
 */
export async function notifyAmbassadorRejected({ email, name, programTitle, reason = "", programId }) {
  const headline = "Application Status Update";
  const reasonText = reason ? `<p><strong>Feedback:</strong> ${reason}</p>` : "";
  const content = `
    <p>Hi ${name},</p>
    <p>Thank you for your interest in <strong>${programTitle}</strong>. After careful review, the organizer is unable to offer you an ambassador role for this cohort.</p>
    ${reasonText}
    <p>We appreciate your interest in TicketLelo and encourage you to explore other events and upcoming opportunities on our platform.</p>
  `;
  const html = buildBrandedHtml({ headline, contentHtml: content });

  await recordNotificationLog({
    recipientEmail: email,
    type: NOTIFICATION_TYPES.APPLICATION_REJECTED,
    programId,
    title: headline,
    body: `Application to ${programTitle} was declined.`,
  });

  try {
    await enqueueEmail({
      recipient: email,
      subject: `[TicketLelo] Application Update: ${programTitle}`,
      html,
      priority: "P2",
    });
  } catch (err) {
    console.warn("[notifications] Rejection email dispatch warning:", err?.message);
  }
}

/**
 * 5. Points Awarded -> Ambassador Notification
 */
export async function notifyPointsAwarded({ email, name, pointsAwarded, newTotal, eventName, programId }) {
  const headline = `+${pointsAwarded} Points Earned! ⚡`;
  const content = `
    <p>Hi ${name},</p>
    <p>An attendee successfully registered for <strong>${eventName || "an event"}</strong> using your referral code!</p>
    <p><strong>Points Added:</strong> +${pointsAwarded}<br><strong>Current Balance:</strong> ${newTotal} Points</p>
    <p>Check the leaderboard and browse available rewards in your dashboard.</p>
  `;
  const html = buildBrandedHtml({
    headline,
    contentHtml: content,
    ctaText: "View Points & Rewards",
    ctaUrl: "https://www.ticketlelo.com/ambassador/dashboard",
  });

  await recordNotificationLog({
    recipientEmail: email,
    type: NOTIFICATION_TYPES.POINTS_AWARDED,
    programId,
    title: headline,
    body: `Earned ${pointsAwarded} points for ${eventName}. Total: ${newTotal}`,
  });

  try {
    await enqueueEmail({
      recipient: email,
      subject: `[TicketLelo] +${pointsAwarded} Points Earned! Your new balance: ${newTotal}`,
      html,
      priority: "P2",
    });
  } catch (err) {
    console.warn("[notifications] Points email dispatch warning:", err?.message);
  }
}

/**
 * 6. Reward Claimed -> Ambassador Confirmation
 */
export async function notifyRewardClaimed({ email, name, rewardTitle, claimInstructions = "", programId }) {
  const headline = `Reward Claim Confirmed: ${rewardTitle} 🎁`;
  const instructionsHtml = claimInstructions ? `<div style="background-color: #131517; padding: 12px; border-radius: 8px; margin: 12px 0;"><p style="margin: 0; color: #FFFFFF;">${claimInstructions}</p></div>` : "";
  const content = `
    <p>Hi ${name},</p>
    <p>You have successfully redeemed <strong>${rewardTitle}</strong>!</p>
    ${instructionsHtml}
    <p>The program organizer has been notified and will fulfill any physical or custom access perks.</p>
  `;
  const html = buildBrandedHtml({ headline, contentHtml: content });

  await recordNotificationLog({
    recipientEmail: email,
    type: NOTIFICATION_TYPES.REWARD_CLAIMED,
    programId,
    title: headline,
    body: `Redeemed reward: ${rewardTitle}`,
  });

  try {
    await enqueueEmail({
      recipient: email,
      subject: `[TicketLelo] Reward Claimed: ${rewardTitle}`,
      html,
      priority: "P1",
    });
  } catch (err) {
    console.warn("[notifications] Reward email dispatch warning:", err?.message);
  }
}


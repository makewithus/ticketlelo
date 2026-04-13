import emailjs from "emailjs-com";

/**
 * Initialize EmailJS
 */
export const initializeEmailJS = () => {
  try {
    if (process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY) {
      emailjs.init(process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY);
    }
  } catch (error) {
    console.error("EmailJS initialization error:", error);
  }
};

/**
 * Send registration confirmation email with PDF ticket attached
 * Uses server-side Nodemailer API route to send the actual PDF
 * @param email - Recipient email
 * @param fullName - Recipient name
 * @param eventName - Event name
 * @param ticketId - Ticket ID
 * @param password - User password (optional, for new users)
 * @returns {Promise<boolean>} - Returns true if email sent successfully, false otherwise
 */
export const sendRegistrationConfirmation = async (
  email,
  fullName,
  eventName,
  ticketId,
  password = null,
) => {
  try {
    console.log("=== [Email] sendRegistrationConfirmation called ===");
    console.log("   Email:", email);
    console.log("   FullName:", fullName);
    console.log("   EventName:", eventName);
    console.log("   TicketId:", ticketId);
    console.log("   Password:", password);
    console.log("   Password type:", typeof password);
    console.log("   Password exists:", !!password);
    console.log("================================================");

    const response = await fetch("/api/send-ticket-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId,
        email,
        fullName,
        eventName,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Email] API returned error:", data);
      return false;
    }

    console.log("[Email] Ticket PDF email sent successfully:", data);
    return true;
  } catch (error) {
    console.error(
      "[Email] Failed to send ticket email:",
      error?.message || error,
    );
    return false;
  }
};

/**
 * Send ticket used notification
 * @param email - Recipient email
 * @param fullName - Recipient name
 * @param eventName - Event name
 * @param usedAt - When the ticket was used
 */
export const sendTicketUsedNotification = async (
  email,
  fullName,
  eventName,
  usedAt,
) => {
  try {
    if (!process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID) {
      console.warn("EmailJS service ID not configured");
      return;
    }

    await emailjs.send(
      process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "template_default",
      {
        to_email: email,
        to_name: fullName,
        event_name: eventName,
        used_at: usedAt.toLocaleString(),
        subject: `Ticket Used - ${eventName}`,
        message: `Hi ${fullName},\n\nYour ticket for ${eventName} was used on ${usedAt.toLocaleString()}.\n\nThank you for attending!`,
      },
    );
  } catch (error) {
    console.error("Send ticket used notification error:", error.message);
    // Don't throw - this is a non-critical notification
  }
};

/**
 * Send admin notification of new registration
 * @param adminEmail - Admin email
 * @param registrantName - Registrant name
 * @param eventName - Event name
 * @param registrationTime - When registration occurred
 */
export const sendAdminRegistrationNotification = async (
  adminEmail,
  registrantName,
  eventName,
  registrationTime,
) => {
  try {
    if (!process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID) {
      console.warn("EmailJS service ID not configured");
      return;
    }

    await emailjs.send(
      process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "template_default",
      {
        to_email: adminEmail,
        to_name: "Admin",
        event_name: eventName,
        registrant_name: registrantName,
        registration_time: registrationTime.toLocaleString(),
        subject: `New Registration - ${eventName}`,
        message: `New registration received:\n\nRegistrant: ${registrantName}\nEvent: ${eventName}\nTime: ${registrationTime.toLocaleString()}`,
      },
    );
  } catch (error) {
    console.error("Send admin notification error:", error.message);
    // Don't throw - this is a non-critical notification
  }
};

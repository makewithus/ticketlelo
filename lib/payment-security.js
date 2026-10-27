import crypto from "node:crypto";

export function configuredPaymentSecret(value) {
  return typeof value === "string" && value.trim() && !/placeholder/i.test(value) ? value : null;
}

export function verifyPaymentHmac(message, signature, secret) {
  if (!configuredPaymentSecret(secret) || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha256", secret).update(message).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

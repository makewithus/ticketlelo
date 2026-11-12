// Unit/simulation tests must never inherit production credentials or load .env.
process.env.NODE_ENV = 'test';
for (const key of Object.keys(process.env)) {
  if (/^(FIREBASE_SERVICE_ACCOUNT_KEY|FIREBASE_ADMIN_|GOOGLE_PRIVATE_KEY|GOOGLE_SERVICE_ACCOUNT_EMAIL|GOOGLE_SHEETS_|GOOGLE_WALLET_|APPLE_PASS_|APPLE_TEAM_|RAZORPAY_|SMTP_|WHATSAPP_|QR_SIGNING_SECRET|QR_HMAC_SECRET_KEY)/.test(key)) delete process.env[key];
}
Object.assign(process.env, {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-qa-api-key',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-ticketlelo-qa',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-ticketlelo-qa.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123:web:qa',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-ticketlelo-qa.appspot.com',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3027',
});

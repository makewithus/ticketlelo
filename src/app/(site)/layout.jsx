// Root layout for the UI dev's pages (landing, privacy, terms).
// It deliberately does NOT import the app's Tailwind globals.css so the
// Webflow stylesheet renders exactly as designed.
export const metadata = {
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
  other: { "google-site-verification": "ekF7mKOHfvz007N96iD1_R2G9wfeSmpA7VpfFGzY2l4" },
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function SiteRootLayout({ children }) {
  return (
    <html
      lang="en"
      data-wf-domain="ticketlelo.in"
      data-wf-page="669ca5dfa907442c9c03e470"
      data-wf-site="65c9009e540efb0e283997c5"
      suppressHydrationWarning
    >
      <body className="body" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

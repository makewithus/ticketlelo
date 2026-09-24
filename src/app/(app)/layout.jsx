import { Toaster } from "sonner";

import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/components/ui/theme-provider";

export const metadata = {
  title: "TicketLelo - Event Ticketing Platform",
  description: "Professional event ticketing and management platform",
  generator: "v0.app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>{children}</AuthProvider>
          <Toaster 
            position="top-right" 
            theme="dark" 
            richColors 
            toastOptions={{
              style: {
                background: '#111111',
                border: '1px solid #333333',
                color: '#ffffff',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

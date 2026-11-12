import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ToastGuard } from "@/components/ui/toast-guard";

import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { SessionTimeoutManager } from "@/components/auth/session-timeout-manager";

import { ModalScrollLockProvider } from "@/components/ui/modal-scroll-lock-provider";
import { ReferralCapturer } from "@/components/common/referral-capturer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "TicketLelo - Event Ticketing Platform",
  description: "Professional event ticketing and management platform",
  generator: "v0.app",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`max-w-full overflow-x-hidden ${inter.variable}`}>
      <body className={`antialiased font-sans ${inter.className} bg-background text-foreground transition-colors duration-150 max-w-full overflow-x-hidden`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <SessionTimeoutManager />
            <ReferralCapturer />
          </AuthProvider>
          <ModalScrollLockProvider />
          <ToastGuard />
          <Toaster 
            position="top-right" 
            theme="dark" 
            closeButton
            expand={false}
            visibleToasts={3}
            gap={12}
            toastOptions={{
              classNames: {
                toast: "tl-toast",
                success: "tl-toast-success",
                error: "tl-toast-error",
                warning: "tl-toast-warning",
                info: "tl-toast-info",
                title: "tl-toast-title",
                description: "tl-toast-description",
                closeButton: "tl-toast-close",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

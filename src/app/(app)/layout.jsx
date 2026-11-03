import { Toaster } from "sonner";
import { ToastGuard } from "@/components/ui/toast-guard";

import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/components/ui/theme-provider";

import { ModalScrollLockProvider } from "@/components/ui/modal-scroll-lock-provider";

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
    <html lang="en" suppressHydrationWarning className="max-w-full overflow-x-clip">
      <body className="antialiased font-sans bg-background text-foreground transition-colors duration-150 max-w-full overflow-x-clip">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>{children}</AuthProvider>
          <ModalScrollLockProvider />
          <ToastGuard />
          <Toaster 
            position="top-right" 
            theme="dark" 
            closeButton
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

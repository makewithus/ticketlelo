import { Toaster } from "sonner";
import { ToastGuard } from "@/components/ui/toast-guard";

import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/components/ui/theme-provider";

export const metadata = {
  title: "TicketLelo - Event Ticketing Platform",
  description: "Professional event ticketing and management platform",
  generator: "v0.app",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans bg-background text-foreground transition-colors duration-150">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>{children}</AuthProvider>
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

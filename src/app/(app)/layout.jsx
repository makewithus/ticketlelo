import { Toaster } from "sonner";

import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>{children}</AuthProvider>
          <ThemeToggle className="fixed right-4 z-[100] shadow-lg" />
          <Toaster 
            position="top-right" 
            theme="light" 
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

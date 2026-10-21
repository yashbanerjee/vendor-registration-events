import type { Metadata } from "next";
import { themeBoot } from "@/lib/theme";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "s7",
  description: "Events and exhibitions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

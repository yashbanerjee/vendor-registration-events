import type { Metadata } from "next";
import { themeBoot } from "@/lib/theme";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "iktva Forum 2027",
  description: "Vendor registration for iktva Forum 2027",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

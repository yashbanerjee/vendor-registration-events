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
    <html lang="en" className="dark font-sans" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/Montserrat-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Montserrat-Medium.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Montserrat-SemiBold.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Montserrat-Bold.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="font-sans antialiased" style={{ fontFamily: '"Montserrat", sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

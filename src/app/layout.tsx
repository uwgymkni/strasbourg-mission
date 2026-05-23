import type { Metadata, Viewport } from "next";
import { Inter, Crimson_Pro } from "next/font/google";
import { AppProvider } from "@/providers/AppProvider";
import "@/styles/globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Strasbourg Mission",
    template: "%s — Strasbourg Mission",
  },
  description: "Ein pädagogisches Erkundungsspiel durch die Straßen Straßburgs — BG/BRG Knittelfeld.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Strasbourg Mission",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B1426",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${inter.variable} ${crimsonPro.variable}`}>
      <body className="bg-navy-950 text-cream antialiased font-sans">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rolefield-gcc.arbaz-uddin613787.chatgpt.site"),
  title: "RoleField — Enterprise Voice Agents for the GCC",
  description: "Arabic-native enterprise voice agents for customer service, collections, booking and operations across the GCC. A company by AI7Lab, UAE.",
  openGraph: {
    title: "RoleField — Arabic AI agents that sound local",
    description: "A locally fluent AI workforce, built in the UAE for the GCC.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "RoleField voice AI for the GCC" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RoleField — Arabic AI agents that sound local",
    description: "A locally fluent AI workforce, built in the UAE for the GCC.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

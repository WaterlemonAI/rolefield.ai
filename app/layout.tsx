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
  title: "RoleField — Autonomous AI Workforce for the GCC",
  description: "Arabic-native, multilingual AI agents that run customer operations end to end across the GCC. A company by AI7Lab, UAE.",
  openGraph: {
    title: "RoleField — One AI workforce for every GCC customer",
    description: "Configurable multilingual agents that converse, act, follow up and improve around your business outcomes.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "RoleField voice AI for the GCC" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RoleField — One AI workforce for every GCC customer",
    description: "Configurable multilingual agents that converse, act, follow up and improve around your business outcomes.",
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

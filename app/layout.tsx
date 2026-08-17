import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AnalyticsConsent } from "@/components/google-analytics";
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
  metadataBase: new URL("https://rolefield.ai"),
  title: { default: "RoleField — Autonomous AI Workforce for the GCC", template: "%s | RoleField" },
  description: "Arabic-native, multilingual AI agents that run customer operations end to end across the GCC. A company by AI7Lab, UAE.",
  alternates: { canonical: "/" },
  keywords: ["AI agents", "customer operations", "voice AI", "GCC", "Arabic AI", "workflow automation"],
  authors: [{ name: "RoleField", url: "https://rolefield.ai" }],
  creator: "AI7Lab",
  publisher: "AI7Lab",
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
        <Script id="google-consent-mode" strategy="beforeInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          var analyticsConsent = 'denied';
          try { analyticsConsent = localStorage.getItem('rolefield-analytics-consent') === 'granted' ? 'granted' : 'denied'; } catch (e) {}
          gtag('consent', 'default', { analytics_storage: analyticsConsent });
        `}</Script>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-8GPGN7W055" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`gtag('js', new Date()); gtag('config', 'G-8GPGN7W055');`}</Script>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "Organization", name: "RoleField", url: "https://rolefield.ai",
          logo: "https://rolefield.ai/rolefield-logo.png", email: "voice@ai7lab.net",
          parentOrganization: { "@type": "Organization", name: "AI7Lab" },
          address: { "@type": "PostalAddress", addressLocality: "Dubai", addressRegion: "DIFC", addressCountry: "AE" },
        }).replace(/</g, "\\u003c") }} />
        {children}
        <AnalyticsConsent />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AnalyticsConsent } from "@/components/google-analytics";
import "./globals.css";
import "./business-theme.css";

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
  title: { default: "Rolefield — Enterprise AI for the Real World", template: "%s | Rolefield" },
  description: "Rolefield puts enterprise AI to work across customer conversations, physical service and live environments—at a scale of 15 million conversations every month.",
  alternates: { canonical: "/" },
  keywords: ["enterprise AI", "customer operations", "voice AI", "agentic kiosk", "real-world intelligence", "AI automation"],
  authors: [{ name: "RoleField", url: "https://rolefield.ai" }],
  creator: "AI7Lab",
  publisher: "AI7Lab",
  openGraph: {
    title: "Rolefield — Lower the cost. Raise the standard.",
    description: "Enterprise AI across customer conversations, physical spaces and live environments.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "RoleField voice AI for the GCC" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rolefield — Lower the cost. Raise the standard.",
    description: "Enterprise AI across customer conversations, physical spaces and live environments.",
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
          parentOrganization: { "@type": "Organization", name: "AI7Lab Tech Evolution Pte. Ltd.", url: "https://www.ai7lab.net" },
          address: { "@type": "PostalAddress", addressLocality: "Dubai", addressRegion: "DIFC", addressCountry: "AE" },
        }).replace(/</g, "\\u003c") }} />
        {children}
        <AnalyticsConsent />
      </body>
    </html>
  );
}

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/app",
        "/login",
        "/setup",
        "/activate",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: "https://rolefield.ai/sitemap.xml",
    host: "https://rolefield.ai",
  };
}

import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/about", "/contact", "/partnerships", "/roi-calculator", "/terms", "/privacy"];
  return pages.map((path) => ({ url: `https://rolefield.ai${path}`, lastModified: new Date("2026-08-18"), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : path === "/contact" ? .8 : .6 }));
}

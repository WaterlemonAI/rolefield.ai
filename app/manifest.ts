import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Rolefield", short_name: "Rolefield", description: "Enterprise AI for the real world.", start_url: "/", display: "standalone", background_color: "#fbfdff", theme_color: "#071b36", icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }, { src: "/rolefield-icon.png", sizes: "512x512", type: "image/png" }] };
}

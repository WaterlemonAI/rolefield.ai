import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "RoleField", short_name: "RoleField", description: "Autonomous customer operations for the GCC.", start_url: "/", display: "standalone", background_color: "#f6f2ea", theme_color: "#14213d", icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }] };
}

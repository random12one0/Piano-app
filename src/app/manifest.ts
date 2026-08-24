import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Practice Rail",
    short_name: "Practice Rail",
    description: "A personal piano practice companion — songs, lesson segments, and progress in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#16181b",
    theme_color: "#16181b",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

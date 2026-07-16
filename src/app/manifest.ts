import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WetinDey",
    short_name: "WetinDey",
    description: "Confirm food availability and prices in your neighborhood.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F7F5",
    theme_color: "#087A50",
    icons: [
      {
        src: "/icon.jpg",
        sizes: "512x512",
        type: "image/jpeg",
      },
    ],
  };
}

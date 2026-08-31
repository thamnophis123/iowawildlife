import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "leaflet",
    "leaflet.markercluster",
    "react-leaflet",
    "react-leaflet-cluster",
  ],
};

export default nextConfig;

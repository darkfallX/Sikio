import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/ear`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/approve`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/receipts`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}

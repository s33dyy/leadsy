import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leadsy Revenue OS",
  description:
    "AI-native revenue intelligence, CRM, routing, outreach automation, and analytics for modern revenue teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

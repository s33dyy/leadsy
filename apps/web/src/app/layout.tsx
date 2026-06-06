import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leadsy AI Lead Capture, Qualification & Conversion Platform",
  description:
    "Capture leads, qualify conversations with AI, manage follow-up, and convert prospects with human-approved outreach.",
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

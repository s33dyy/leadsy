import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leadsy AI Lead Intelligence & Operations Platform",
  description:
    "Research prospects, build lead knowledge, generate operator tasks, and draft outreach for human approval.",
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

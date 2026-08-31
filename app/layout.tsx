import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GwenSick — Strategic Intelligence",
  description: "Strategic AI intelligence for competitive players, teams, and operators.",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workspace.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "GwenSick — Strategic Intelligence",
  description: "Strategic AI intelligence for people making decisions under pressure.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

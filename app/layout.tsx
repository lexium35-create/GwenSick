import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GwenSick — AI Chat",
  description: "A focused AI chat experience powered by OpenAI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

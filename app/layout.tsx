import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/literata/400.css";
import "@fontsource/literata/500.css";
import "@fontsource/literata/600.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/500.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-telugu/400.css";
import "@fontsource/noto-sans-telugu/500.css";
import "@fontsource/noto-sans-telugu/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Akshara — Read with meaning",
  description:
    "A calm, multilingual reading companion for discovering texts, translations, and thoughtful discussion.",
};

export const viewport: Viewport = {
  themeColor: "#f6f5f0",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce");

  return (
    <html lang="en">
      <body nonce={nonce ?? undefined}>{children}</body>
    </html>
  );
}

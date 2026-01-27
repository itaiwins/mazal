import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mazal - Jewish Dating App | Find Your Bashert",
  description:
    "The modern dating app built for Jewish singles. Find meaningful connections with Mazal - featuring modern dating, Orthodox shidduch mode, and family matchmaking.",
  keywords: [
    "Jewish dating",
    "Jewish singles",
    "Shidduch",
    "Bashert",
    "Jewish matchmaking",
    "Orthodox dating",
    "Safta mode",
  ],
  authors: [{ name: "Mazal Inc." }],
  openGraph: {
    title: "Mazal - Find Your Bashert",
    description:
      "L'chaim to love. The dating app built for Jewish singles.",
    type: "website",
    locale: "en_US",
    siteName: "Mazal",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mazal - Jewish Dating App",
    description: "Find your bashert with Mazal",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

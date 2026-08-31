import { AUTHOR, DOCS_URL } from "../lib/constants";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: {
    default: "IntelliBiz — The Operating System for Business Logic",
    template: "%s | IntelliBiz",
  },
  description:
    "A unified, fiscally-aware backend engine powered by TypeScript & Native Rust. Build commerce, fintech, and SaaS applications with zero floating-point errors, automatic tenancy isolation, and immutable audit trails.",
  keywords: [
    "intellibiz",
    "backend framework",
    "typescript",
    "rust",
    "commerce",
    "fintech",
    "multi-tenant",
    "fixed-point arithmetic",
    "business logic",
    "saas",
  ],
  authors: [{ name: AUTHOR }],
  creator: AUTHOR,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: DOCS_URL,
    siteName: "IntelliBiz",
    title: "IntelliBiz — The Operating System for Business Logic",
    description:
      "A unified, fiscally-aware backend engine powered by TypeScript & Native Rust.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "IntelliBiz",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IntelliBiz — The Operating System for Business Logic",
    description:
      "A unified, fiscally-aware backend engine powered by TypeScript & Native Rust.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#4f46e5" />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}

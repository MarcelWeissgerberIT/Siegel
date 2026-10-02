import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN || "http://localhost:3000"),
  title: { default: "Siegel · Proposals that close themselves", template: "%s · Siegel" },
  description:
    "From call notes to signed and paid in under 5 minutes, with signatures you can actually prove. AI proposals, e-signatures with a hash-chained audit trail, Stripe deposits and webhooks. Free, self-hosted, yours.",
  icons: { icon: `${BASE}/favicon.svg` },
  openGraph: {
    title: "Siegel · Proposals that close themselves",
    description: "AI proposals → verifiable e-signature → Stripe deposit → webhook. Self-hosted, replaces PandaDoc + DocuSign.",
    images: [`${BASE}/og.jpg`],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0908" },
    { media: "(prefers-color-scheme: light)", color: "#f8f6f2" },
  ],
};

// Applied before paint so there is no light/dark flash.
const themeScript = `(function(){try{var t=localStorage.getItem('siegel:theme');if(!t||t==='system'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

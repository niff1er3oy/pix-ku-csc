import type { Metadata, Viewport } from "next";
import { K2D, Noto_Sans_Thai_Looped } from "next/font/google";

import { GridBackground } from "@/components/ui/grid-background";
import { getDictionary, getLocale } from "@/lib/i18n";

import "./globals.css";

/* Display: rounded geometric with a bit of mischief in the letterforms.
   Playful without trying, and pointedly not the Kanit/Prompt pairing that
   every other Thai site reaches for. */
const k2d = K2D({
  variable: "--font-k2d",
  subsets: ["latin", "thai"],
  weight: ["600", "700"],
  display: "swap",
});

/* Body: *looped* Thai. Thai readers register looped letterforms as friendly
   and approachable where loopless ones read as technical, and looped stays
   legible at small sizes in bright sun — which is the actual reading scene. */
const notoThai = Noto_Sans_Thai_Looped({
  variable: "--font-noto-thai",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/**
 * Locale-aware, because the link pasted into a group chat is how most people
 * arrive — a preview card in the wrong language is the first thing they judge.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const title = `${dict.brand.name} — ${dict.brand.tagline}`;

  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ),
    title: { default: title, template: `%s · ${dict.brand.name}` },
    description: dict.home.sub,
    openGraph: {
      type: "website",
      siteName: dict.brand.name,
      title,
      description: dict.home.sub,
      locale: locale === "th" ? "th_TH" : "en_US",
    },
    twitter: { card: "summary_large_image", title, description: dict.home.sub },
  };
}

export const viewport: Viewport = {
  // Mirrors --color-green-600 in globals.css. Metadata cannot read a CSS
  // custom property, so this is the one place the brand hex is duplicated —
  // change both together.
  themeColor: "#00706b",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <html
      lang={locale}
      className={`${k2d.variable} ${notoThai.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink antialiased">
        {/* The page's white ground, replaced by a slowly drifting green grid.
            Fixed and viewport-sized on purpose: an absolute layer would have
            to be as tall as the document, so a long gallery page would carry a
            composited surface many screens high for no visible gain. Sections
            with their own fill — the green bands, cards, the cloud panels —
            simply cover it, so the texture only shows in the white gaps. */}
        <GridBackground
          variant="page"
          size={56}
          speed="fast"
          fade={false}
          className="fixed -z-10"
        />

        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-pill focus-visible:bg-green-600 focus-visible:px-5 focus-visible:py-2 focus-visible:text-paper"
        >
          {dict.nav.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}

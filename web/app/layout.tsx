import type { Metadata } from "next";
import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { MockBadge } from "@/components/ui/MockBadge";

// Variable fonts — omit `weight` and expose as CSS variables (see globals.css).
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DiamondAI — Live MLB, predicted pitch by pitch",
  description:
    "Watch what's happening in the game next to what the model thinks happens next: pitch type, at-bat outcome, and live win probability.",
};

// Apply the persisted theme before paint to avoid a flash (matches the design).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('diamondai-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${bricolage.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* liquid-glass refraction: feTurbulence -> feDisplacementMap bends the backdrop */}
        <svg
          width="0"
          height="0"
          style={{ position: "absolute", pointerEvents: "none" }}
          aria-hidden="true"
        >
          <filter
            id="liquid-glass"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.009 0.011"
              numOctaves="2"
              seed="42"
              result="noise"
            />
            <feGaussianBlur in="noise" stdDeviation="1.4" result="soft" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="soft"
              scale="42"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
        {children}
        <MockBadge />
      </body>
    </html>
  );
}

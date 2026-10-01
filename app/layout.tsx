import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Big_Shoulders_Inline, Courier_Prime, Libre_Franklin } from "next/font/google";
import { MotionRoot } from "@/components/MotionRoot";
import "./globals.css";

// Picture Palace type. The brief names "Big Shoulders Display" and "Big Shoulders
// Inline Display"; Google has merged those into the variable "Big Shoulders" and
// "Big Shoulders Inline" families. Their optical-size axis gives the Display cut
// at headline sizes, so these are the same faces under their current names.

// next/font has no size-adjust metrics for these two, so they fall back to the
// boards' own condensed stack instead of a generated fallback.

// Headlines and film titles: 900, caps, set tight.
const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
  adjustFontFallback: false,
});

// Marquee signage only: the setup sign, the valance, "It's a match".
const signage = Big_Shoulders_Inline({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-signage",
  display: "swap",
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
  adjustFontFallback: false,
});

// UI and body: a Franklin Gothic revival, the sans of old posters and playbills.
const sans = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Tickets, labels and credits: caps, wide tracking, small.
const mono = Courier_Prime({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Movie Match",
  description: "Two people, one phone, three rounds. A film you both want to watch tonight.",
};

// The browser chrome takes the colour of the room.
export const viewport: Viewport = {
  themeColor: "#0e0a09",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${signage.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}

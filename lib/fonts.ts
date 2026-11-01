import { STIX_Two_Text, Spline_Sans_Mono } from "next/font/google";

export const stix = STIX_Two_Text({
  variable: "--font-stix",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});
export const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

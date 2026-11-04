import type { MarketResult } from "./logic";

// Five classes on "times the district rate". The outer cuts (0.5 and 2) are the same as the calls
// (supply pocket / demand hotspot), so a zone's colour and its label always agree.
// Ends are ColorBrewer RdYlGn; the middle is a warm neutral that sits on the basemap.
export const STEPS = [
  { upTo: 0.5, colour: "#D73027", label: "0.5× or less" },
  { upTo: 0.8, colour: "#F4A582", label: "0.5–0.8×" },
  { upTo: 1.25, colour: "#E4E1D8", label: "Near average" },
  { upTo: 2, colour: "#A6D96A", label: "1.25–2×" },
  { upTo: Infinity, colour: "#1A9850", label: "2× or more" },
] as const;

export const THIN = "#F1EFEA";

export const stepColour = (index: number) => STEPS.find((s) => (s.upTo === 0.5 ? index <= s.upTo : index < s.upTo))!.colour;

export const zoneColour = (m: MarketResult) => (m.call === "Thin data" ? THIN : stepColour(m.index));

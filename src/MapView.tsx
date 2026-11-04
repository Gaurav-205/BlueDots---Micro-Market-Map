import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APIProvider, Map as GMap, useMap } from "@vis.gl/react-google-maps";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import * as turf from "@turf/turf";
import { fmtInt } from "./lib/logic";
import { zonesFor } from "./lib/zones";
import { JOB, SEEKER } from "./lib/colours";
import type { DistrictResult, View } from "./lib/logic";
import type { Data } from "./lib/useData";
import { flowsFor } from "./lib/flows";

const KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.GOOGLE_MAPS_API_KEY) as string | undefined;


// The normal Google map (as in KYD), with shop and transit icons hidden so the market cards stand out.
// Labels are English (language="en" on APIProvider). Works without a map ID, so cards are drawn in an OverlayView.
const STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// Market cards are placed so nothing touches: not another card, not a pin, not the legend or map controls, and a
// card's line never runs through another card. Each market (biggest first) takes the nearest free spot on rings
// around its pin. All maths is in container px (what the user sees).
type Box = { l: number; t: number; r: number; b: number };
const GAP = 12; // minimum clear space around every card
const CARD_H = 42;
const cardW = (name: string) => Math.max(120, name.length * 7.4 + 24);
const RINGS = [56, 84, 116, 150, 190, 236];
const ANGLES = Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8);
const hits = (a: Box, b: Box, pad = 0) => a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;
// Right-angle line: up or down from the pin to the card's level, then across to its near edge (or straight in if above/below).
function leader(px: number, py: number, c: Box) {
  const cy = (c.t + c.b) / 2;
  if (px >= c.l && px <= c.r) return [[px, py, px, py < c.t ? c.t : c.b]];
  const ex = px < c.l ? c.l : c.r;
  return [[px, py, px, cy], [px, cy, ex, cy]];
}
const segHitsBox = ([x1, y1, x2, y2]: number[], b: Box) => hits({ l: Math.min(x1, x2), t: Math.min(y1, y2), r: Math.max(x1, x2), b: Math.max(y1, y2) }, b, 2);
const segsCross = (a: number[], b: number[]) => {
  const [h, v] = a[1] === a[3] ? [a, b] : [b, a];
  if (h[1] !== h[3] || v[0] !== v[2]) return false; // only a horizontal and a vertical can cross
  return v[0] > Math.min(h[0], h[2]) && v[0] < Math.max(h[0], h[2]) && h[1] > Math.min(v[1], v[3]) && h[1] < Math.max(v[1], v[3]);
};
function placeAll(items: { id: string; name: string; x: number; y: number }[], w: number, h: number, blocked: Box[]) {
  const cards: Box[] = [];
  const lines: number[][] = [];
  const pins = items.map((p): Box => ({ l: p.x - 8, t: p.y - 8, r: p.x + 8, b: p.y + 8 }));
  const out = new Map<string, Box>();
  for (const p of items) {
    const cw = cardW(p.name);
    let best = null as { box: Box; cost: number } | null;
    const tryAt = (cx: number, cy: number, dist: number, strict: boolean) => {
      const box = { l: cx - cw / 2, t: cy - CARD_H / 2, r: cx + cw / 2, b: cy + CARD_H / 2 };
      if (box.l < 8 || box.t < 8 || box.r > w - 8 || box.b > h - 8) return;
      if (cards.some((c) => hits(box, c, GAP)) || pins.some((q) => hits(box, q, GAP / 2)) || blocked.some((z) => hits(box, z, GAP))) return;
      const segs = leader(p.x, p.y, box);
      if (strict && segs.some((s) => cards.some((c) => segHitsBox(s, c)))) return;
      const crossings = segs.reduce((n, s) => n + lines.filter((l) => segsCross(s, l)).length, 0);
      const cost = dist + crossings * 120 + (cy > p.y ? 8 : 0); // nearest wins; crossings and "below" cost extra
      if (!best || cost < best.cost) best = { box, cost };
    };
    for (const r of RINGS) for (const a of ANGLES) tryAt(p.x + r * Math.cos(a), p.y - r * Math.sin(a), r, true);
    // Small or crowded map: search the whole map for the nearest free spot, first keeping lines off cards, then not.
    for (const strict of [true, false]) {
      if (best) break;
      for (let cy = 8 + CARD_H / 2; cy <= h - 8 - CARD_H / 2; cy += 10)
        for (let cx = 8 + cw / 2; cx <= w - 8 - cw / 2; cx += 10) tryAt(cx, cy, Math.hypot(cx - p.x, cy - p.y), strict);
    }
    // Nowhere fully free (tiny map): take the on-screen spot that overlaps other things the least.
    if (!best) {
      const area = (a: Box, b: Box) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
      for (let cy = 8 + CARD_H / 2; cy <= h - 8 - CARD_H / 2; cy += 10)
        for (let cx = 8 + cw / 2; cx <= w - 8 - cw / 2; cx += 10) {
          const box = { l: cx - cw / 2, t: cy - CARD_H / 2, r: cx + cw / 2, b: cy + CARD_H / 2 };
          const cost = [...cards, ...blocked].reduce((n, z) => n + area(box, z), 0) * 10 + Math.hypot(cx - p.x, cy - p.y);
          if (!best || cost < best.cost) best = { box, cost };
        }
    }
    const box = best?.box ?? { l: p.x - cw / 2, t: p.y - 56 - CARD_H / 2, r: p.x + cw / 2, b: p.y - 56 + CARD_H / 2 };
    cards.push(box);
    lines.push(...leader(p.x, p.y, box));
    out.set(p.id, box);
  }
  return out;
}

const FLOW = "#334155";

type Geom = Feature<Polygon | MultiPolygon>;
const toPaths = (g: Geom) =>
  (g.geometry.type === "Polygon" ? [g.geometry.coordinates] : g.geometry.coordinates).flatMap((poly) =>
    poly.map((ring) => ring.map(([lng, lat]) => ({ lat, lng }))),
  );

type LL = { lat: number; lng: number };
// A gentle arc from a to b (bends to the right of travel) so lines to nearby markets don't stack.
const arc = (a: LL, b: LL): LL[] => {
  const c = { lat: (a.lat + b.lat) / 2 - (b.lng - a.lng) * 0.18, lng: (a.lng + b.lng) / 2 + (b.lat - a.lat) * 0.18 };
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24, u = 1 - t;
    return { lat: u * u * a.lat + 2 * u * t * c.lat + t * t * b.lat, lng: u * u * a.lng + 2 * u * t * c.lng + t * t * b.lng };
  });
};

interface Props {
  data: Data;
  result: DistrictResult;
  view: View;
  selected: string;
  onSelect: (id: string) => void;
}

export default function MapView(props: Props) {
  const [type, setType] = useState<"roadmap" | "hybrid">("roadmap");
  if (!KEY) {
    return (
      <div className="state" style={{ flexDirection: "column", gap: 4 }}>
        <span><span className="dot" style={{ display: "inline-block", marginRight: 6 }} />Google Maps key missing</span>
        <span>Set VITE_GOOGLE_MAPS_API_KEY in .env.local and restart.</span>
      </div>
    );
  }
  return (
    <APIProvider apiKey={KEY} language="en">
      <GMap
        mapTypeId={type}
        styles={STYLE}
        defaultCenter={{ lat: 28.7, lng: 77.45 }}
        defaultZoom={10}
        isFractionalZoomEnabled
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      >
        <Layers {...props} />
      </GMap>
      <div className="maptype seg" role="group" aria-label="Map type">
        <button type="button" aria-pressed={type === "roadmap"} onClick={() => setType("roadmap")}>Map</button>
        <button type="button" aria-pressed={type === "hybrid"} onClick={() => setType("hybrid")}>Satellite</button>
      </div>
    </APIProvider>
  );
}

// An overlay pane React can portal into, plus the projection to place things on it. Redraws on every zoom.
function useOverlay(map: google.maps.Map | null) {
  const [ov, setOv] = useState<{ el: HTMLElement; proj: google.maps.MapCanvasProjection; n: number } | null>(null);
  useEffect(() => {
    if (!map) return;
    const o = new google.maps.OverlayView();
    const el = document.createElement("div");
    google.maps.OverlayView.preventMapHitsAndGesturesFrom(el);
    o.onAdd = () => o.getPanes()!.overlayMouseTarget.appendChild(el);
    o.draw = () => setOv((p) => ({ el, proj: o.getProjection(), n: (p?.n ?? 0) + 1 }));
    o.onRemove = () => el.remove();
    o.setMap(map);
    return () => o.setMap(null);
  }, [map]);
  return ov;
}

function Layers({ data, result, view, selected, onSelect }: Props) {
  const map = useMap();
  const ov = useOverlay(map);
  const outline = data.outlines!.features.find((f) => f.properties.district === view.district);
  const select = useRef(onSelect);
  select.current = onSelect;

  // Top 5 places the selected market's seekers applied to, with both ends on the map.
  const links = useMemo(() => {
    if (!selected || !data.flows) return [];
    const at = new Map(data.centres!.map((c) => [c.market_id, { lat: c.lat, lng: c.lng }]));
    const from = at.get(selected);
    if (!from) return [];
    return flowsFor(data.flows, selected).out.placed.filter((l) => at.has(l.id)).slice(0, 5)
      .map((l) => ({ ...l, from, to: at.get(l.id)! }));
  }, [selected, data.flows, data.centres]);

  // Fit to the district outline whenever the district changes.
  useEffect(() => {
    if (!map || !outline) return;
    const b = new google.maps.LatLngBounds();
    toPaths(outline).flat().forEach((p) => b.extend(p));
    // Refit when the map box changes size too (phone layout settles after the first fit).
    // Leave some room around the district so cards can also sit in the faded area outside it.
    const fit = () => map.fitBounds(b, map.getDiv().clientWidth >= 760 ? { top: 60, bottom: 40, left: 110, right: 110 } : 16);
    const ro = new ResizeObserver(fit);
    ro.observe(map.getDiv());
    return () => ro.disconnect();
  }, [map, outline]);

  // Our district stays at full colour; everything outside it is faded (a big box with the district cut out),
  // and the district gets a dark border. A click on the map (not a card) clears the selection.
  useEffect(() => {
    if (!map || !outline) return;
    const [w, so, e, n] = turf.bbox(outline);
    const pad = 3;
    const frame = [{ lat: n + pad, lng: w - pad }, { lat: n + pad, lng: e + pad }, { lat: so - pad, lng: e + pad }, { lat: so - pad, lng: w - pad }];
    // A hole only cuts out if it winds opposite to the frame (frame is clockwise, so holes must be counter-clockwise).
    const ccw = (r: LL[]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + (p.lng * q.lat - q.lng * p.lat); }, 0) > 0;
    const holes = (outline.geometry.type === "Polygon" ? [outline.geometry.coordinates] : outline.geometry.coordinates)
      .map((poly) => poly[0].map(([lng, lat]) => ({ lat, lng })))
      .map((r) => (ccw(r) ? r : r.reverse()));
    const shapes = [
      new google.maps.Polygon({ map, paths: [frame, ...holes], clickable: false, strokeOpacity: 0, fillColor: "#FFFFFF", fillOpacity: 0.6, zIndex: 0 }),
      new google.maps.Polygon({ map, paths: toPaths(outline), clickable: false, strokeColor: "#0A1317", strokeOpacity: 0.9, strokeWeight: 2.5, fillOpacity: 0, zIndex: 1 }),
    ];
    const clear = map.addListener("click", () => select.current(""));
    return () => { shapes.forEach((x) => x.setMap(null)); clear.remove(); };
  }, [map, outline]);

  // The chosen market's own area (the same shape the counts use) lights up.
  const zones = useMemo(() => zonesFor(view.district, data.centres!, data.outlines!), [view.district, data.centres, data.outlines]);
  useEffect(() => {
    const z = zones.find((x) => x.properties.market_id === selected);
    if (!map || !z) return;
    const area = new google.maps.Polygon({
      map, paths: toPaths(z), clickable: false, strokeColor: "#b97f00", strokeOpacity: 1, strokeWeight: 3, fillColor: "#b97f00", fillOpacity: 0.18, zIndex: 2,
    });
    return () => area.setMap(null);
  }, [map, zones, selected]);

  // Curved lines from the selected market to where its seekers applied, width by number of applications.
  useEffect(() => {
    if (!map || !links.length) return;
    const max = links[0].n;
    const lines = links.map((l) => new google.maps.Polyline({
      map, path: arc(l.from, l.to), clickable: false, zIndex: 3,
      strokeColor: FLOW, strokeOpacity: 0.8, strokeWeight: 1.5 + 3 * Math.sqrt(l.n / max),
      icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2, strokeWeight: 1, fillOpacity: 1, fillColor: FLOW, strokeColor: FLOW }, offset: "55%" }],
    }));
    return () => lines.forEach((x) => x.setMap(null));
  }, [map, links]);

  const markets = result.markets.filter((m) => !m.isRest && m.lat != null);

  // One card per market (name, seekers, jobs), placed by placeAll so nothing overlaps; joined to its pin by a right-angle line.
  const placed = ov && map ? (() => {
    const order = [...markets].sort((a, b) => (b.market_id === selected ? 1 : 0) - (a.market_id === selected ? 1 : 0) || b.seekers + b.demand - (a.seekers + a.demand));
    if (!order.length) return [];
    const div = map.getDiv(), w = div.clientWidth, h = div.clientHeight;
    const ll = (m: (typeof order)[number]) => new google.maps.LatLng(m.lat!, m.lng!);
    // Overlay px = container px + a fixed shift; work out the shift from one point.
    const d0 = ov.proj.fromLatLngToDivPixel(ll(order[0]))!, c0 = ov.proj.fromLatLngToContainerPixel(ll(order[0]))!;
    const sx = d0.x - c0.x, sy = d0.y - c0.y;
    const items = order.map((m) => { const c = ov.proj.fromLatLngToContainerPixel(ll(m))!; return { id: m.market_id, name: m.market.replace(" and ", " & "), x: c.x, y: c.y, m }; });
    // Things cards must not cover: the legend (bottom-left), the Map/Satellite switch (top-right), zoom buttons (bottom-right).
    const blocked: Box[] = [
      { l: 0, t: h - 140, r: 270, b: h },
      { l: w - 200, t: 0, r: w, b: 60 },
      { l: w - 64, t: h - 120, r: w, b: h },
    ];
    // The application counts on the chosen market's lines are obstacles too.
    for (const l of links) {
      const at = arc(l.from, l.to)[17];
      const c = ov.proj.fromLatLngToContainerPixel(new google.maps.LatLng(at.lat, at.lng))!;
      blocked.push({ l: c.x - 16, t: c.y - 10, r: c.x + 16, b: c.y + 10 });
    }
    const boxes = placeAll(items, w, h, blocked);
    return items.map((p) => {
      const b = boxes.get(p.id)!;
      const path = leader(p.x, p.y, b).map(([x1, y1, x2, y2], k) => `${k ? "" : `M${x1 - p.x} ${y1 - p.y} `}L${x2 - p.x} ${y2 - p.y}`).join(" ");
      return { m: p.m, x: p.x + sx, y: p.y + sy, cx: b.l - p.x, cy: b.t - p.y, cw: b.r - b.l, path };
    });
  })() : [];

  return (
    <>
      {ov && createPortal(
        <>
          {links.map((l) => {
            // On the line, 70% of the way along, so it doesn't sit on the destination's label.
            const at = arc(l.from, l.to)[17];
            const p = ov.proj.fromLatLngToDivPixel(new google.maps.LatLng(at.lat, at.lng))!;
            return <div key={`f${l.id}`} className="flowtag" style={{ left: p.x, top: p.y }}>{fmtInt(l.n)}</div>;
          })}
          {placed.map(({ m, x, y, cx, cy, cw, path }) => {
            const on = m.market_id === selected;
            return (
              <div key={m.market_id} className={`area${selected && !on ? " dim" : ""}`} style={{ left: x, top: y, zIndex: on ? 1000 : 100 }}>
                {/* Right-angle path from the pin to its card (90° turns only). */}
                <svg className="area-leader" width="1" height="1" aria-hidden><path d={path} /></svg>
                <span className="area-pin" />
                <button type="button" className={`area-chip${on ? " on" : ""}`} style={{ left: cx, top: cy, width: cw, height: CARD_H, transform: "none" }}
                  onClick={(e) => { e.stopPropagation(); onSelect(on ? "" : m.market_id); }}>
                  <b>{m.market.replace(" and ", " & ")}</b>
                  <span>
                    <i style={{ background: SEEKER }} />{fmtInt(m.seekers)}<span className="sr-only"> seekers,</span>
                    <i style={{ background: JOB }} />{fmtInt(m.demand)}<span className="sr-only"> {view.measure === "openings" ? "openings" : "postings"}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </>,
        ov.el,
      )}
    </>
  );
}

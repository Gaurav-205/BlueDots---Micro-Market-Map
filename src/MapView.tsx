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

// Card size in px and the spots tried around a market's point, nearest first (KYD's placeCards).
const CARD = { w: 170, h: 40 };
// KYD tried 9 spots; central Hubli-Dharwad packs several markets within a few px, so try a 5 x 7 grid, nearest first.
const SPOTS: [number, number][] = [-260, -130, 0, 130, 260]
  .flatMap((dx) => [-138, -92, -46, 0, 46, 92, 138].map((dy): [number, number] => [dx, dy]))
  .sort((a, b) => Math.hypot(a[0] / 1.6, a[1]) - Math.hypot(b[0] / 1.6, b[1]));
const CARD_LIFT = 40; // cards sit this far above their point, joined to a pin by a short line

// Wide maps put the cards in two columns in the faded area outside the district, so the district itself stays clear.
const COL_ROOM = 230; // px kept free left and right of the district for the columns
const ROW = 50; // vertical step between stacked cards
const LEGEND_H = 170; // the legend (plus its margin and half a card) sits bottom-left; the left column stops above it
const wide = (el: HTMLElement) => el.clientWidth >= 760;

/** Card per pin in container px: west-side markets go to a left column, east-side to a right one, each stacked in pin order. */
function placeColumns(pins: { id: string; x: number; y: number }[], box: { left: number; right: number; cx: number }, w: number, h: number) {
  const out = new Map<string, { x: number; y: number; side: "L" | "R"; lane: number }>();
  for (const side of ["L", "R"] as const) {
    const col = pins.filter((p) => (side === "L" ? p.x < box.cx : p.x >= box.cx)).sort((a, b) => a.y - b.y);
    const top = side === "L" ? 28 : 72; // the Map/Satellite switch sits top-right
    const bottom = h - (side === "L" ? LEGEND_H + 28 : 28);
    const ys = col.map((p) => Math.min(Math.max(p.y, top), bottom));
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + ROW);
    for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.max(top, Math.min(ys[i], i === ys.length - 1 ? bottom : ys[i + 1] - ROW));
    const x = side === "L" ? Math.max(box.left - 16, COL_ROOM - 30) : Math.min(box.right + 16, w - COL_ROOM + 30);
    // Each line turns at its own lane between the column and the district, so vertical runs never sit on top of each other.
    col.forEach((p, i) => out.set(p.id, { x, y: ys[i], side, lane: x + (side === "L" ? 1 : -1) * (12 + 6 * i) }));
  }
  return out;
}
function placeCards(points: { id: string; x: number; y: number }[]): Map<string, [number, number]> {
  const boxes: { x: number; y: number }[] = [];
  const out = new Map<string, [number, number]>();
  for (const p of points) {
    const free = SPOTS.find(([dx, dy]) => boxes.every((b) => Math.abs(b.x - (p.x + dx)) >= CARD.w || Math.abs(b.y - (p.y + dy)) >= CARD.h)) ?? SPOTS[0];
    boxes.push({ x: p.x + free[0], y: p.y + free[1] });
    out.set(p.id, free);
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
    // On a wide map leave room left and right for the card columns (see placeColumns); otherwise a small margin.
    const fit = () => map.fitBounds(b, wide(map.getDiv()) ? { top: 48, bottom: 24, left: COL_ROOM, right: COL_ROOM } : 24);
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

  // One card per market (name, seekers, jobs). Wide map: columns outside the district. Narrow map: KYD's placement
  // next to each pin (biggest first, nearest free spot). Each card gets a right-angle line to its pin.
  const placed = ov && map && outline ? (() => {
    const order = [...markets].sort((a, b) => (b.market_id === selected ? 1 : 0) - (a.market_id === selected ? 1 : 0) || b.seekers + b.demand - (a.seekers + a.demand));
    const pts = order.map((m) => ({ m, ...ov.proj.fromLatLngToDivPixel(new google.maps.LatLng(m.lat!, m.lng!))! }));
    const div = map.getDiv();
    if (wide(div)) {
      // Column maths in container px (what the user sees), then shifted back into the overlay's own px.
      const toC = (lat: number, lng: number) => ov.proj.fromLatLngToContainerPixel(new google.maps.LatLng(lat, lng))!;
      const [w, s, e, n] = turf.bbox(outline);
      const nw = toC(n, w), se = toC(s, e);
      const shift = { x: pts.length ? pts[0].x - toC(order[0].lat!, order[0].lng!).x : 0, y: pts.length ? pts[0].y - toC(order[0].lat!, order[0].lng!).y : 0 };
      const cols = placeColumns(pts.map((p) => ({ id: p.m.market_id, x: p.x - shift.x, y: p.y - shift.y })),
        { left: nw.x, right: se.x, cx: (nw.x + se.x) / 2 }, div.clientWidth, div.clientHeight);
      return pts.map((p) => {
        const c = cols.get(p.m.market_id)!;
        const cx = c.x + shift.x - p.x, cy = c.y + shift.y - p.y, lane = c.lane + shift.x - p.x;
        // Leave the pin sideways, turn at the lane, go up or down to the card's level, then into the card.
        return { ...p, cx, cy, path: `M0 0 H${lane} V${cy} H${cx}`, anchor: c.side === "L" ? "translate(-100%, -50%)" : "translate(0, -50%)" };
      });
    }
    const off = placeCards(pts.map((p) => ({ id: p.m.market_id, x: p.x, y: p.y })));
    return pts.map((p) => {
      const [dx, dy] = off.get(p.m.market_id)!;
      return { ...p, cx: dx, cy: dy - CARD_LIFT, path: `M0 0 V${dy - CARD_LIFT} H${dx}`, anchor: "translate(-50%, -50%)" };
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
          {placed.map(({ m, x, y, cx, cy, path, anchor }) => {
            const on = m.market_id === selected;
            return (
              <div key={m.market_id} className={`area${selected && !on ? " dim" : ""}`} style={{ left: x, top: y, zIndex: on ? 1000 : 100 }}>
                {/* Right-angle path from the pin to its card (90° turns only). */}
                <svg className="area-leader" width="1" height="1" aria-hidden><path d={path} /></svg>
                <span className="area-pin" />
                <button type="button" className={`area-chip${on ? " on" : ""}`} style={{ left: cx, top: cy, transform: anchor }}
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

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APIProvider, Map as GMap, useMap } from "@vis.gl/react-google-maps";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { fmtInt } from "./lib/logic";
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
  pins: boolean;
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

function Layers({ data, result, view, selected, pins, onSelect }: Props) {
  const map = useMap();
  const ov = useOverlay(map);
  const outline = data.outlines!.features.find((f) => f.properties.district === view.district);
  const byId = useMemo(() => new Map(result.markets.map((m) => [m.market_id, m])), [result]);
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
    const fit = () => map.fitBounds(b, 24);
    const ro = new ResizeObserver(fit);
    ro.observe(map.getDiv());
    return () => ro.disconnect();
  }, [map, outline]);

  // Thin district outline for orientation, and a click on the map (not a card) clears the selection.
  useEffect(() => {
    if (!map || !outline) return;
    const line = new google.maps.Polygon({
      map, paths: toPaths(outline), clickable: false, strokeColor: "#0A1317", strokeOpacity: 0.5, strokeWeight: 1.5, fillOpacity: 0, zIndex: 0,
    });
    const clear = map.addListener("click", () => select.current(""));
    return () => { line.setMap(null); clear.remove(); };
  }, [map, outline]);

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
  const cells = pins && data.cells ? data.cells.filter((c) => c.district === view.district) : [];
  const pinField = view.age === "recent" ? "postings_recent" : view.age === "30d" ? "postings_30d" : "postings";
  const peakS = Math.max(1, ...cells.map((c) => c.seekers));
  const peakP = Math.max(1, ...cells.map((c) => c[pinField]));
  const selName = selected ? byId.get(selected)?.market : undefined;

  // One card per market (name, seekers, jobs), biggest first; each takes the nearest spot that doesn't cover another card.
  const placed = ov ? (() => {
    const order = [...markets].sort((a, b) => (b.market_id === selected ? 1 : 0) - (a.market_id === selected ? 1 : 0) || b.seekers + b.demand - (a.seekers + a.demand));
    const pts = order.map((m) => ({ m, ...ov.proj.fromLatLngToDivPixel(new google.maps.LatLng(m.lat!, m.lng!))! }));
    const off = placeCards(pts.map((p) => ({ id: p.m.market_id, x: p.x, y: p.y })));
    return pts.map((p) => ({ ...p, d: off.get(p.m.market_id)! }));
  })() : [];

  return (
    <>
      {selName && links.length > 0 && (
        <div className="flowcap">
          <i aria-hidden /> Where seekers from <b>{selName}</b> applied (number = applications)
        </div>
      )}
      {ov && createPortal(
        <>
          {cells.map((c, i) => {
            const p = ov.proj.fromLatLngToDivPixel(new google.maps.LatLng(c.cell_lat, c.cell_lng))!;
            return <div key={`s${i}`} className="pin-s" style={{ left: p.x, top: p.y, ["--d" as string]: `${2 * Math.max(2, 11 * Math.sqrt(c.seekers / peakS))}px` }} />;
          })}
          {cells.filter((c) => c[pinField] > 0).map((c, i) => {
            const p = ov.proj.fromLatLngToDivPixel(new google.maps.LatLng(c.cell_lat, c.cell_lng))!;
            return <div key={`p${i}`} className="pin-p" style={{ left: p.x, top: p.y, ["--d" as string]: `${Math.max(4, 16 * Math.sqrt(c[pinField] / peakP))}px` }} />;
          })}
          {links.map((l) => {
            // On the line, 70% of the way along, so it doesn't sit on the destination's label.
            const at = arc(l.from, l.to)[17];
            const p = ov.proj.fromLatLngToDivPixel(new google.maps.LatLng(at.lat, at.lng))!;
            return <div key={`f${l.id}`} className="flowtag" style={{ left: p.x, top: p.y }}>{fmtInt(l.n)}</div>;
          })}
          {placed.map(({ m, x, y, d: [dx, dy] }) => {
            const on = m.market_id === selected;
            return (
              <div key={m.market_id} className={`area${selected && !on ? " dim" : ""}`} style={{ left: x, top: y, zIndex: on ? 1000 : 100 }}>
                <svg className="area-leader" width="1" height="1" aria-hidden><line x1="0" y1="0" x2={dx} y2={dy - CARD_LIFT} /></svg>
                <span className="area-pin" />
                <button type="button" className={`area-chip${on ? " on" : ""}`} style={{ translate: `${dx}px ${dy - CARD_LIFT}px` }}
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

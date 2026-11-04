import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APIProvider, Map as GMap, useMap } from "@vis.gl/react-google-maps";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { interpolateRgb } from "d3-interpolate";
import { callLabel, fmt1, fmtInt, unitWord, zoneT } from "./lib/logic";
import type { DistrictResult, MarketResult, View } from "./lib/logic";
import type { Data } from "./lib/useData";
import { zonesFor } from "./lib/zones";
import { flowsFor } from "./lib/flows";
import { callColour } from "./Panel";

const KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.GOOGLE_MAPS_API_KEY) as string | undefined;

const lo = interpolateRgb("#E8833A", "#D5D9DF");
const hi = interpolateRgb("#D5D9DF", "#2B8FA6");
export const zoneColour = (m: MarketResult) =>
  m.call === "Thin data" ? "#E3E6EA" : ((t) => (t < 0.5 ? lo(t * 2) : hi((t - 0.5) * 2)))(zoneT(m.index));

// Quiet grey basemap so the zones carry the colour. Works only without a map ID, so markers are drawn in an OverlayView.
const STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f3f4f6" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7b8494" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f3f4f6" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e4e7eb" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d7e3ea" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#9aa1ab" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
];

const FLOW = "#1E6F82";

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

interface Hover { id: string; x: number; y: number }

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
    <APIProvider apiKey={KEY}>
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
  const [hover, setHover] = useState<Hover | null>(null);
  const outline = data.outlines!.features.find((f) => f.properties.district === view.district);
  const zones = useMemo(() => zonesFor(view.district, data.centres!, data.outlines!), [view.district, data.centres, data.outlines]);
  const byId = useMemo(() => new Map(result.markets.map((m) => [m.market_id, m])), [result]);
  const polys = useRef(new Map<string, google.maps.Polygon>());
  const sel = useRef(selected);
  sel.current = selected;
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

  // Outline and zones are drawn imperatively; react-google-maps has no polygon component.
  useEffect(() => {
    if (!map || !outline) return;
    const shapes: google.maps.Polygon[] = [];
    shapes.push(new google.maps.Polygon({
      map, paths: toPaths(outline), clickable: false,
      strokeColor: "#1F2933", strokeOpacity: 0.55, strokeWeight: 1.25, fillColor: "#1F2933", fillOpacity: 0.03,
    }));
    const box = map.getDiv();
    for (const z of zones) {
      const id = z.properties.market_id;
      const p = new google.maps.Polygon({ map, paths: toPaths(z), strokeColor: "#FFFFFF", strokeWeight: 1.5, zIndex: 1 });
      const at = (e: google.maps.MapMouseEvent) => {
        const ev = e.domEvent as MouseEvent, r = box.getBoundingClientRect();
        setHover({ id, x: ev.clientX - r.left, y: ev.clientY - r.top });
      };
      p.addListener("click", () => select.current(id === sel.current ? "" : id));
      p.addListener("mousemove", at);
      p.addListener("mouseout", () => setHover(null));
      polys.current.set(id, p);
      shapes.push(p);
    }
    const clear = map.addListener("click", () => select.current(""));
    return () => {
      shapes.forEach((s) => s.setMap(null));
      polys.current.clear();
      clear.remove();
    };
  }, [map, outline, zones]);

  // Curved lines from the selected market to where its seekers applied, width by number of applications.
  useEffect(() => {
    if (!map || !links.length) return;
    const max = links[0].n;
    const lines = links.map((l) => new google.maps.Polyline({
      map, path: arc(l.from, l.to), clickable: false, zIndex: 3,
      strokeColor: FLOW, strokeOpacity: 0.85, strokeWeight: 2 + 5 * Math.sqrt(l.n / max),
      icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.5, strokeWeight: 1, fillOpacity: 1, fillColor: FLOW, strokeColor: FLOW }, offset: "55%" }],
    }));
    return () => lines.forEach((x) => x.setMap(null));
  }, [map, links]);

  // Restyle zones when the view or selection changes.
  useEffect(() => {
    polys.current.forEach((p, id) => {
      const m = byId.get(id);
      if (!m) return;
      const on = id === selected;
      p.setOptions({
        fillColor: zoneColour(m),
        fillOpacity: selected && !on ? 0.2 : 0.55,
        strokeColor: on ? "#1F2933" : "#FFFFFF",
        strokeWeight: on ? 2.5 : 1.5,
        zIndex: on ? 2 : 1,
      });
    });
  }, [byId, selected, zones]);

  const markets = result.markets.filter((m) => !m.isRest && m.lat != null);
  const cells = pins && data.cells ? data.cells.filter((c) => c.district === view.district) : [];
  const pinField = view.age === "recent" ? "postings_recent" : "postings";
  const peakS = Math.max(1, ...cells.map((c) => c.seekers));
  const peakP = Math.max(1, ...cells.map((c) => c[pinField]));
  const peakSeekers = Math.max(1, ...markets.map((m) => m.seekers));
  const h = hover && byId.get(hover.id);
  const box = map?.getDiv();
  const w = box?.clientWidth ?? 600, hh = box?.clientHeight ?? 600;
  const selName = selected ? byId.get(selected)?.market : undefined;

  // Place each bubble, then keep a name only if it doesn't collide with one already placed (selected and biggest first).
  const placed = ov ? (() => {
    const px = (lat: number, lng: number) => ov.proj.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng))!;
    const order = [...markets].sort((a, b) => (b.market_id === selected ? 1 : 0) - (a.market_id === selected ? 1 : 0) || b.seekers - a.seekers);
    const taken: [number, number, number, number][] = [];
    const hit = (r: [number, number, number, number]) => taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]);
    return order.map((m) => {
      const p = px(m.lat!, m.lng!);
      const d = Math.round(26 + 22 * Math.sqrt(m.seekers / peakSeekers));
      taken.push([p.x - d / 2, p.y - d / 2, p.x + d / 2, p.y + d / 2]);
      const lw = m.market.length * 6.6 + 12;
      const label: [number, number, number, number] = [p.x - lw / 2, p.y + d / 2 + 2, p.x + lw / 2, p.y + d / 2 + 20];
      const named = m.market_id === selected || !hit(label);
      if (named) taken.push(label);
      return { m, x: p.x, y: p.y, d, named };
    });
  })() : [];

  return (
    <>
      {selName && links.length > 0 && (
        <div className="flowcap">
          <i aria-hidden /> Where seekers from <b>{selName}</b> applied · top {links.length} markets, line width = applications
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
            const p = ov.proj.fromLatLngToDivPixel(new google.maps.LatLng(l.to.lat, l.to.lng))!;
            return <div key={`f${l.id}`} className="flowtag" style={{ left: p.x, top: p.y }}>{fmtInt(l.n)} applied</div>;
          })}
          {placed.map(({ m, x, y, d, named }) => {
            const on = m.market_id === selected;
            return (
              <button key={m.market_id} type="button" title={m.market}
                className={`mk${on ? " on" : ""}${selected && !on ? " dim" : ""}`}
                style={{ left: x, top: y, zIndex: on ? 1000 : 100 + Math.round(m.seekers / 100) }}
                onClick={(e) => { e.stopPropagation(); onSelect(on ? "" : m.market_id); }}
                onMouseEnter={(e) => { const r = box!.getBoundingClientRect(); setHover({ id: m.market_id, x: e.clientX - r.left, y: e.clientY - r.top }); }}
                onMouseLeave={() => setHover(null)}>
                <span className="mk-dot" style={{ width: d, height: d, background: m.call === "Thin data" ? "#9CA3AF" : zoneColour(m) }}>{fmt1(m.rate)}</span>
                {named && <span className="mk-name">{m.market}</span>}
              </button>
            );
          })}
        </>,
        ov.el,
      )}
      {h && (
        <div className="tip" style={{ left: Math.min(Math.max(hover!.x + 14, 4), w - 214), top: Math.min(Math.max(hover!.y + 14, 4), hh - 120) }}>
          <div className="tip-name">{h.market}</div>
          <div className="tip-call"><span className="cdot" style={{ background: callColour(h.call) }} />{callLabel(h.call)}</div>
          <div className="tip-grid">
            <span>Seekers</span><b>{fmtInt(h.seekers)}</b>
            <span>{unitWord(view).replace(/^./, (c) => c.toUpperCase())}</span><b>{fmtInt(h.demand)}</b>
            <span>Per 100 seekers</span><b>{fmt1(h.rate)}</b>
          </div>
        </div>
      )}
    </>
  );
}

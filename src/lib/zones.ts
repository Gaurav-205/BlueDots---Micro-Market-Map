import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { Centre, Outlines } from "./useData";

export type Zone = Feature<Polygon | MultiPolygon, { market_id: string }>;

const memo = new Map<string, Zone[]>();

// Display only: shrink a zone ~200 m and round its corners so zones read as soft tiles with gaps.
// The assignment rule (and every count) is unchanged. Tiny zones that would vanish keep their exact shape.
function soften(f: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> {
  const inner = turf.buffer(f, -0.45, { units: "kilometers" });
  const round = inner && turf.buffer(inner, 0.25, { units: "kilometers", steps: 8 });
  return round?.geometry ? (round as Feature<Polygon | MultiPolygon>) : f;
}

// Zone = Voronoi cell ∩ circle(radius_km) ∩ district outline, matching the SQL assignment rule.
export function zonesFor(district: string, centres: Centre[], outlines: Outlines): Zone[] {
  const hit = memo.get(district);
  if (hit) return hit;
  const outline = outlines.features.find((f) => f.properties.district === district);
  const cs = centres.filter((c) => c.district === district);
  if (!outline || !cs.length) return [];
  const [w, s, e, n] = turf.bbox(outline);
  const pad = 0.2;
  const pts = turf.featureCollection(cs.map((c) => turf.point([c.lng, c.lat], { market_id: c.market_id })));
  const cells = turf.voronoi(pts, { bbox: [w - pad, s - pad, e + pad, n + pad] });
  const zones: Zone[] = [];
  cs.forEach((c) => {
    const cell = cells.features.find((f) => f && turf.booleanPointInPolygon([c.lng, c.lat], f));
    if (!cell) return;
    const circle = turf.circle([c.lng, c.lat], c.radius_km, { units: "kilometers", steps: 96 });
    const a = turf.intersect(turf.featureCollection([cell, circle]));
    const b = a && turf.intersect(turf.featureCollection([a, outline]));
    if (b) zones.push({ ...soften(b), properties: { market_id: c.market_id } } as Zone);
  });
  memo.set(district, zones);
  return zones;
}

import { useEffect, useState } from "react";
import Papa from "papaparse";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type { CellRow, CoverageRow, MarketRow, RoleRow } from "./logic";
import type { FlowRow } from "./flows";

export type Status = "loading" | "ok" | "error" | "missing";

export interface Centre {
  market_id: string;
  district: string;
  market: string;
  localities: string;
  lat: number;
  lng: number;
  radius_km: number;
}

export type Outlines = FeatureCollection<Polygon | MultiPolygon, { district: string }>;

export interface Data {
  markets: MarketRow[] | null;
  roles: RoleRow[] | null;
  coverage: CoverageRow[] | null;
  cells: CellRow[] | null;
  flows: FlowRow[] | null;
  centres: Centre[] | null;
  outlines: Outlines | null;
  status: Record<"markets" | "roles" | "coverage" | "cells" | "flows" | "centres" | "outlines", Status>;
}

const NUM: Record<string, string[]> = {
  markets: ["lat", "lng", "radius_km", "seekers", "postings", "postings_recent", "openings", "openings_recent", "postings_30d", "openings_30d"],
  roles: ["postings", "role_rank"],
  coverage: ["total_live", "usable", "outside_district", "default_point", "no_location", "usable_pct"],
  cells: ["cell_lat", "cell_lng", "seekers", "postings", "postings_recent", "postings_30d"],
  flows: ["applications", "accepted", "applications_recent"],
};
const KEEP: Record<string, string[]> = {
  markets: ["district", "market_id", "market", "localities", ...NUM.markets],
  roles: ["district", "market_id", "job_role", ...NUM.roles],
  coverage: ["district", "kind", ...NUM.coverage],
  cells: ["district", "market_id", ...NUM.cells],
  flows: ["district", "from_market", "to_market", ...NUM.flows],
};

const base = `${import.meta.env.BASE_URL}data/`;

async function fetchText(name: string): Promise<string> {
  const res = await fetch(base + name);
  // Vite dev serves index.html for missing files, so check the type too.
  if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) throw new Error(`${name}: ${res.status}`);
  return res.text();
}

async function loadCsv<T>(kind: keyof typeof NUM): Promise<T[]> {
  const text = await fetchText(`${kind}.csv`);
  const { data } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return data.map((r) => {
    const o: Record<string, string | number | null> = {};
    for (const k of KEEP[kind]) {
      const v = (r[k] ?? "").trim();
      o[k] = NUM[kind].includes(k) ? (v === "" ? null : Number(v)) : v;
    }
    return o as T;
  });
}

let cache: Promise<Data> | null = null;

function loadAll(): Promise<Data> {
  const status = {} as Data["status"];
  const wrap = <T,>(key: keyof Data["status"], p: Promise<T>, optional = false) =>
    p.then(
      (v) => ((status[key] = "ok"), v),
      (e) => {
        if (!optional) console.error(`Failed to load ${key}`, e);
        status[key] = optional ? "missing" : "error";
        return null;
      },
    );
  return Promise.all([
    wrap("markets", loadCsv<MarketRow>("markets")),
    wrap("roles", loadCsv<RoleRow>("roles")),
    wrap("coverage", loadCsv<CoverageRow>("coverage")),
    wrap("cells", loadCsv<CellRow>("cells"), true),
    wrap("flows", loadCsv<FlowRow>("flows"), true),
    wrap("centres", fetchText("market_centres.json").then((t) => JSON.parse(t) as Centre[])),
    wrap("outlines", fetchText("district_outlines.geojson").then((t) => JSON.parse(t) as Outlines)),
  ]).then(([markets, roles, coverage, cells, flows, centres, outlines]) => ({
    markets, roles, coverage, cells, flows, centres, outlines, status,
  }));
}

const LOADING: Data = {
  markets: null, roles: null, coverage: null, cells: null, flows: null, centres: null, outlines: null,
  status: { markets: "loading", roles: "loading", coverage: "loading", cells: "loading", flows: "loading", centres: "loading", outlines: "loading" },
};

export function useData(): Data {
  const [data, setData] = useState<Data>(LOADING);
  useEffect(() => {
    cache ??= loadAll();
    cache.then(setData);
  }, []);
  return data;
}

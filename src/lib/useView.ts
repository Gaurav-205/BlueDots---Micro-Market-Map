import { useCallback, useEffect, useState } from "react";
import type { Age, District, Measure } from "./logic";

export interface UrlView {
  district: District;
  measure: Measure;
  age: Age;
  market: string;
  pins: boolean;
}

function read(): UrlView {
  const q = new URLSearchParams(window.location.search);
  return {
    district: q.get("district") === "Hubli-Dharwad" ? "Hubli-Dharwad" : "Ghaziabad",
    measure: q.get("measure") === "openings" ? "openings" : "postings",
    age: q.get("age") === "recent" ? "recent" : "all",
    market: q.get("market") ?? "",
    // Pins are off by default: hundreds of dots cluttered the first view.
    pins: q.get("pins") === "1",
  };
}

export function useView(): [UrlView, (patch: Partial<UrlView>) => void] {
  const [view, setView] = useState(read);

  useEffect(() => {
    const onPop = () => setView(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const update = useCallback((patch: Partial<UrlView>) => {
    setView((v) => {
      const next = { ...v, ...patch };
      if (patch.district && patch.district !== v.district && !("market" in patch)) next.market = "";
      const q = new URLSearchParams({ district: next.district, measure: next.measure, age: next.age });
      if (next.market) q.set("market", next.market);
      if (next.pins) q.set("pins", "1");
      window.history.replaceState(null, "", `?${q}`);
      return next;
    });
  }, []);

  return [view, update];
}

import { useEffect, useRef, useState } from 'react';
import { api, type Buildings } from './api';

export function mergeBuildings(areas: Buildings[]): Buildings | null {
  if (!areas.length) return null;
  const features = new Map<string, Buildings['features'][number]>();
  for (const area of areas) for (const feature of area.features) {
    const previous = features.get(feature.id);
    if (!previous || previous.height_status === 'ILLUSTRATIVE') features.set(feature.id, feature);
  }
  return { features: [...features.values()], source: areas[0].source,
    retrieved_at: areas.map((area) => area.retrieved_at).sort().at(-1)! };
}

export function useCityBuildings(originId?: string, destinationId?: string, center?: [number, number]) {
  const key = center ? `area:${center[0]},${center[1]}` : `${originId ?? ''}|${destinationId ?? ''}`;
  const longitude = center?.[0], latitude = center?.[1];
  const hasArea = longitude !== undefined && latitude !== undefined;
  const [revision, setRevision] = useState(0);
  const pending = useRef<{ key: string; revision: number; promise: Promise<PromiseSettledResult<Buildings>[]> } | null>(null);
  const [result, setResult] = useState<{ key: string; loading: boolean; buildings: Buildings | null; errors: string[] }>({ key: '', loading: false, buildings: null, errors: [] });
  useEffect(() => {
    let stale = false;
    if (!hasArea && (!originId || !destinationId)) return;
    setResult({ key, loading: true, buildings: null, errors: [] });
    const paths = hasArea
      ? [`city-buildings?longitude=${longitude}&latitude=${latitude}&limit=500`]
      : [...new Set([originId!, destinationId!])].map((id) => `buildings?poi_id=${encodeURIComponent(id)}&limit=200`);
    // React StrictMode replays effects in development. Share the in-flight request
    // for the same trip/retry instead of spending upstream quota twice.
    if (pending.current?.key !== key || pending.current.revision !== revision) {
      pending.current = { key, revision, promise: Promise.allSettled(paths.map((path) => api<Buildings>(path))) };
    }
    pending.current.promise.then((responses) => {
      if (stale) return;
      const areas: Buildings[] = [], errors: string[] = [];
      responses.forEach((response, i) => {
        if (response.status === 'fulfilled') areas.push(response.value);
        else errors.push(`${hasArea ? '当前' : i === 0 ? '起点' : '终点'}街区建筑暂不可用。`);
      });
      setResult({ key, loading: false, buildings: mergeBuildings(areas), errors });
    });
    return () => { stale = true; };
  }, [originId, destinationId, key, revision, hasArea, longitude, latitude]);
  return { ...(result.key === key ? result : { loading: hasArea || Boolean(originId && destinationId), buildings: null, errors: [] }),
    retry: () => setRevision((value) => value + 1) };
}

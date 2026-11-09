import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { api, type Buildings } from './api';
import { mergeBuildings, useCityBuildings } from './useCityBuildings';

vi.mock('./api', () => ({ api: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const area = (id: string, measured = false): Buildings => ({ features: [{ id, footprint: [[117,39],[117.001,39],[117,39.001],[117,39]], height_m: measured ? 30 : 12, height_status: measured ? 'SOURCE_HEIGHT' : 'ILLUSTRATIVE' }], source: 'OSM', retrieved_at: '2026-10-08T04:00:00Z' });

it('loads a public street area without a trip and ignores late previous areas', async () => {
  let resolveOld!: (data: Buildings) => void;
  vi.mocked(api).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve as typeof resolveOld; })).mockResolvedValueOnce(area('shenzhen'));
  const { result, rerender } = renderHook(({ center }) => useCityBuildings(undefined, undefined, center),
    { initialProps: { center: [117.19, 39.12] as [number, number] } });
  expect(api).toHaveBeenCalledWith('city-buildings?longitude=117.19&latitude=39.12&limit=500');
  rerender({ center: [114.06, 22.55] });
  await waitFor(() => expect(result.current.buildings?.features[0].id).toBe('shenzhen'));
  await act(async () => resolveOld(area('tianjin')));
  expect(result.current.buildings?.features[0].id).toBe('shenzhen');
});

it('street area failure can retry without fabricating buildings', async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error('unavailable'));
  const { result } = renderHook(() => useCityBuildings(undefined, undefined, [117.19, 39.12]));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.buildings).toBeNull();
  expect(result.current.errors).toEqual(['当前街区建筑暂不可用。']);
  vi.mocked(api).mockResolvedValueOnce(area('recovered'));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.buildings?.features[0].id).toBe('recovered'));
});

it('moving from home browsing to a trip replaces the home area with route areas', async () => {
  vi.mocked(api).mockResolvedValueOnce(area('home')).mockResolvedValueOnce(area('origin')).mockResolvedValueOnce(area('destination'));
  const { result, rerender } = renderHook(({ trip }) => useCityBuildings(trip ? 'A' : undefined, trip ? 'B' : undefined, trip ? undefined : [117.19, 39.12]), { initialProps: { trip: false } });
  await waitFor(() => expect(result.current.buildings?.features[0].id).toBe('home'));
  rerender({ trip: true });
  await waitFor(() => expect(result.current.buildings?.features.map((f) => f.id)).toEqual(['origin', 'destination']));
});

it('overlapping street areas deduplicate buildings and preserve source height', () => {
  const result = mergeBuildings([area('1'), area('1', true), area('2')]);
  expect(result?.features).toHaveLength(2);
  expect(result?.features[0].height_status).toBe('SOURCE_HEIGHT');
  expect(mergeBuildings([])).toBeNull();
});

it('keeps the successful street area when the other fails, then supports explicit retry', async () => {
  vi.mocked(api).mockResolvedValueOnce(area('1')).mockRejectedValueOnce(new Error('unavailable'));
  const { result } = renderHook(() => useCityBuildings('A', 'B'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.buildings?.features).toHaveLength(1);
  expect(result.current.errors).toEqual(['终点街区建筑暂不可用。']);
  vi.mocked(api).mockResolvedValueOnce(area('1')).mockResolvedValueOnce(area('2'));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.buildings?.features).toHaveLength(2));
  expect(result.current.errors).toEqual([]);
});

it('late buildings from the previous trip cannot replace the new trip', async () => {
  let resolveOld!: (data: Buildings) => void;
  vi.mocked(api).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve as typeof resolveOld; })).mockResolvedValueOnce(area('old2')).mockResolvedValueOnce(area('new1')).mockResolvedValueOnce(area('new2'));
  const { result, rerender } = renderHook(({ origin }) => useCityBuildings(origin, 'B'), { initialProps: { origin: 'A' } });
  rerender({ origin: 'C' });
  await waitFor(() => expect(result.current.buildings?.features[0].id).toBe('new1'));
  await act(async () => resolveOld(area('old1')));
  expect(result.current.buildings?.features.map((f) => f.id)).toEqual(['new1','new2']);
});

it('both failures produce no fabricated model', async () => {
  vi.mocked(api).mockRejectedValue(new Error('unavailable'));
  const { result } = renderHook(() => useCityBuildings('A','B'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.buildings).toBeNull();
  expect(result.current.errors).toHaveLength(2);
});

it('development StrictMode does not duplicate upstream building queries', async () => {
  vi.mocked(api).mockResolvedValue(area('1'));
  const { result } = renderHook(() => useCityBuildings('A','B'), { wrapper: ({ children }) => createElement(StrictMode, null, children) });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(api).toHaveBeenCalledTimes(2);
});

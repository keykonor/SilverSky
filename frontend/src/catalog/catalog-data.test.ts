import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import products from './products.json';

it('has a domestic majority and separate passenger/cargo products with named manufacturers', () => {
  expect(products.length).toBeGreaterThanOrEqual(12);
  expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  expect(products.filter((p) => p.country === '中国').length).toBeGreaterThan(products.length / 2);
  expect(new Set(products.map((p) => p.category))).toEqual(new Set(['passenger','cargo']));
});
it('every published product has a local real image, source, date, driving mode and qualified performance values', () => {
  expect(products.length).toBeGreaterThan(0);
  for (const p of products) {
    expect(p.model && p.company && p.piloting).toBeTruthy();
    expect(p.dataStatus).toBe('PUBLIC_DATA');
    expect(p.checkedAt).toBe('2026-11-06');
    expect(p.sourceUrl).toMatch(/^https:\/\//);
    expect(p.imageSource).toMatch(/^https:\/\//);
    expect(p.image).toMatch(/^\/aircraft-images\//);
    expect(existsSync(resolve(process.cwd(), 'public', p.image.slice(1)))).toBe(true);
    expect(p.metrics.length).toBeGreaterThanOrEqual(3);
    expect(p.metrics.every((m) => m.label && m.value && m.note)).toBe(true);
  }
});

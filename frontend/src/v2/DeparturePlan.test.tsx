import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { beijingInput, DeparturePlan, estimatedArrival } from './DeparturePlan';

afterEach(() => vi.useRealTimers());
const now = Date.parse('2026-10-08T12:00:00+08:00');
it('uses Beijing time independent of browser timezone, and adds actual road duration', () => {
  expect(beijingInput(now)).toBe('2026-10-08T12:00');
  expect(estimatedArrival('2026-10-09T09:00', now, 8.8)).toEqual({ departure: Date.parse('2026-10-09T09:00+08:00'), arrival: Date.parse('2026-10-09T09:09+08:00') });
});
it('does not invent an arrival for an invalid/past departure or unavailable route metric', () => {
  expect(estimatedArrival('2026-10-07T09:00', now, 8)).toBeNull();
  expect(estimatedArrival('invalid', now, 8)).toBeNull();
  expect(estimatedArrival('2026-10-09T09:00', now, NaN)).toBeNull();
});
it('supports now and an editable future departure without new model requests', () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  render(<DeparturePlan plan={{ mode: 'NOW', departure_time: null, departure_window: null, message: '' }} durationMin={8.8} />);
  expect(screen.getByRole('list', { name: '地面出发与到达安排' })).toHaveTextContent('12:09');
  fireEvent.click(screen.getByRole('button', { name: '选择时间' }));
  fireEvent.change(screen.getByLabelText('出发时间（北京时间）'), { target: { value: '2026-10-09T09:00' } });
  expect(screen.getByRole('list')).toHaveTextContent('09:09');
  expect(screen.getByText(/模拟空中路线没有可用运营时间/)).toBeInTheDocument();
});
it('requires confirmation of a vague time and hides arrival until supplied', () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  render(<DeparturePlan plan={{ mode: 'NEEDS_CONFIRMATION', departure_time: null, departure_window: null, message: '请确认明天下午的具体时间' }} durationMin={8} />);
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  expect(screen.getByText('请确认明天下午的具体时间')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('出发时间（北京时间）'), { target: { value: '2026-10-09T15:00' } });
  expect(screen.getByRole('list')).toHaveTextContent('15:08');
});

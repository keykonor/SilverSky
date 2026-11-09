import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSpeech } from './useSpeech';

class Speech {
  static last: Speech;
  lang = ''; continuous = false; interimResults = false;
  onstart: (() => void) | null = null; onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onresult: ((e: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null;
  start = vi.fn(() => this.onstart?.()); stop = vi.fn(); abort = vi.fn();
  constructor() { Speech.last = this; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function install() { Object.defineProperty(window, 'SpeechRecognition', { value: Speech, configurable: true }); }
it('press records Chinese; release waits for final text without triggering analysis', () => {
  install(); const onText = vi.fn();
  const { result, unmount } = renderHook(() => useSpeech(onText));
  act(() => result.current.start());
  expect(Speech.last.lang).toBe('zh-CN');
  expect(result.current.state).toBe('listening');
  act(() => result.current.finish());
  expect(Speech.last.stop).toHaveBeenCalled(); expect(onText).not.toHaveBeenCalled();
  act(() => { Speech.last.onresult?.({ results: [{ isFinal: true, 0: { transcript: '从天津大学去总医院' } }] }); Speech.last.onend?.(); });
  expect(onText).toHaveBeenCalledWith('从天津大学去总医院'); expect(result.current.state).toBe('idle');
  unmount();
});
it('network or denied microphone never reports a successful transcript', () => {
  install(); const onText = vi.fn(); const { result } = renderHook(() => useSpeech(onText));
  act(() => result.current.start()); act(() => Speech.last.onerror?.({ error: 'network' }));
  expect(result.current.message).toContain('连接失败'); expect(result.current.state).toBe('idle'); expect(onText).not.toHaveBeenCalled();
  act(() => result.current.start()); act(() => Speech.last.onerror?.({ error: 'not-allowed' }));
  expect(result.current.message).toContain('权限被拒绝'); expect(onText).not.toHaveBeenCalled();
});
it('no final transcript and timeout have explicit fallbacks', () => {
  install(); vi.useFakeTimers(); const onText = vi.fn(); const { result } = renderHook(() => useSpeech(onText));
  act(() => result.current.start()); act(() => Speech.last.onend?.());
  expect(result.current.message).toContain('未收到');
  act(() => result.current.start()); act(() => result.current.finish()); act(() => vi.advanceTimersByTime(10001));
  expect(result.current.message).toContain('超时'); expect(onText).not.toHaveBeenCalled();
});
it('unsupported browsers retain text/Windows input as fallback', () => {
  Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
  const { result } = renderHook(() => useSpeech(vi.fn())); expect(result.current.supported).toBe(false);
});

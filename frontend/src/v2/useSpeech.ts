import { useEffect, useRef, useState } from 'react';

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const errors: Record<string, string> = {
  'not-allowed': '麦克风权限被拒绝。请允许麦克风后重试，或使用文字输入。',
  'service-not-allowed': '浏览器语音服务不可用。请使用文字或 Windows 语音输入（Win+H）。',
  'audio-capture': '没有可用麦克风。请连接麦克风，或使用文字输入。',
  'no-speech': '没有识别到语音，请按住按钮说话后再松开。',
  network: '语音服务连接失败。请使用文字或 Windows 语音输入（Win+H）。',
  'language-not-supported': '当前语音服务不支持中文，请使用文字或 Win+H。',
};

export function useSpeech(onText: (text: string) => void) {
  const [state, setState] = useState<'idle' | 'listening' | 'finishing'>('idle');
  const [message, setMessage] = useState('');
  const active = useRef<Recognition | null>(null);
  const held = useRef(false);
  const callback = useRef(onText);
  callback.current = onText;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const Speech = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
  const supported = Boolean(Speech);

  useEffect(() => () => {
    clearTimeout(timer.current);
    const recognition = active.current;
    active.current = null;
    if (recognition) { recognition.onend = null; recognition.onerror = null; recognition.onresult = null; recognition.onstart = null; recognition.abort(); }
  }, []);

  function finish() {
    held.current = false;
    const recognition = active.current;
    if (!recognition) return;
    setState('finishing');
    setMessage('正在转写，请稍候…');
    try { recognition.stop(); } catch { /* onstart also stops a released press. */ }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (active.current !== recognition) return;
      active.current = null;
      recognition.abort();
      setState('idle');
      setMessage('语音转写超时，请使用文字或 Windows 语音输入（Win+H）。');
    }, 10000);
  }

  function start() {
    if (!Speech || active.current) return;
    const recognition = new Speech();
    let transcript = '';
    let failed = false;
    active.current = recognition;
    held.current = true;
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = false;
    setState('listening');
    setMessage('正在聆听，松开结束。');
    recognition.onstart = () => { if (!held.current && active.current === recognition) recognition.stop(); };
    recognition.onresult = (event) => {
      if (active.current !== recognition) return;
      transcript = Array.from(event.results).filter((item) => item.isFinal).map((item) => item[0].transcript).join('');
    };
    recognition.onerror = (event) => {
      if (active.current !== recognition) return;
      failed = true;
      setMessage(errors[event.error] ?? '语音识别未成功，请使用文字输入或 Win+H。');
      active.current = null;
      clearTimeout(timer.current);
      setState('idle');
      recognition.abort();
    };
    recognition.onend = () => {
      if (active.current !== recognition) return;
      clearTimeout(timer.current);
      active.current = null;
      setState('idle');
      if (transcript.trim()) {
        callback.current(transcript.trim());
        setMessage('已填入文字，请检查修改后点击完成。');
      } else if (!failed) setMessage('未收到转写文字，请重试或使用文字输入。');
    };
    try {
      recognition.start();
      clearTimeout(timer.current);
      timer.current = setTimeout(finish, 60000);
    } catch {
      active.current = null;
      held.current = false;
      setState('idle');
      setMessage('无法启动语音识别，请使用文字输入或 Win+H。');
    }
  }
  return { supported, state, message, start, finish };
}

import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Volume2, Loader2, Sparkles, Square } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [interimText, setInterimText] = useState('');
  const [textInput, setTextInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isConversationActive = useRef(false);
  const isProcessingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      stopConversation();
    };
  }, []);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignorar si ya estaba detenido
      }
      recognitionRef.current = null;
    }
  };

  const startListening = () => {
    if (!isConversationActive.current || isProcessingRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      isConversationActive.current = false;
      setVoiceState('idle');
      return;
    }

    stopRecognition();
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CL';
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onstart = () => {
      setErrorMsg(null);
      setInterimText('');
      setVoiceState('listening');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += piece;
        } else {
          interim += piece;
        }
      }
      setInterimText(finalTranscript || interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' && isConversationActive.current && !isProcessingRef.current) {
        setTimeout(() => startListening(), 300);
        return;
      }
      if (event.error !== 'aborted') {
        setErrorMsg(`Error de micrófono: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setInterimText('');
      const cleanPrompt = finalTranscript.trim();
      if (cleanPrompt && !isProcessingRef.current) {
        processUserTurn(cleanPrompt, true);
      } else if (isConversationActive.current && !isProcessingRef.current) {
        setTimeout(() => startListening(), 250);
      } else if (!isProcessingRef.current) {
        setVoiceState('idle');
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setTimeout(() => startListening(), 300);
    }
  };

  const processUserTurn = async (prompt: string, resumeMicAfter: boolean) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    stopRecognition();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    setVoiceState('thinking');
    setErrorMsg(null);

    const historySnapshot = [...messagesRef.current];
    setMessages((prev) => [...prev, { role: 'user', text: prompt }]);

    try {
      const chatRes = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, history: historySnapshot }),
        signal: controller.signal,
      });

      const chatData = await chatRes.json();
      if (!chatRes.ok) throw new Error(chatData.error || 'Error al consultar Gemini');

      const replyText: string = chatData.reply;
      setMessages((prev) => [...prev, { role: 'model', text: replyText }]);

      const ttsRes = await fetch(`${API_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText }),
        signal: controller.signal,
      });

      const ttsData = await ttsRes.json();
      if (!ttsRes.ok) throw new Error(ttsData.error || 'Error al sintetizar voz');

      clearTimeout(timeoutId);
      isProcessingRef.current = false;

      stopAudio();
      const audio = new Audio(`data:${ttsData.mimeType};base64,${ttsData.audioBase64}`);
      audioRef.current = audio;
      setVoiceState('speaking');

      audio.onended = () => {
        audioRef.current = null;
        if (resumeMicAfter && isConversationActive.current) {
          startListening();
        } else {
          setVoiceState('idle');
        }
      };

      audio.onerror = () => {
        audioRef.current = null;
        if (resumeMicAfter && isConversationActive.current) {
          startListening();
        } else {
          setVoiceState('idle');
        }
      };

      await audio.play();
    } catch (err: any) {
      clearTimeout(timeoutId);
      isProcessingRef.current = false;
      if (err?.name === 'AbortError') {
        setVoiceState(isConversationActive.current ? 'listening' : 'idle');
        if (isConversationActive.current) startListening();
        return;
      }
      setErrorMsg(err.message || 'Ocurrió un error inesperado');
      if (resumeMicAfter && isConversationActive.current) {
        setTimeout(() => startListening(), 1000);
      } else {
        setVoiceState('idle');
      }
    }
  };

  const startConversation = () => {
    const silentUnlock = new Audio();
    silentUnlock.play().catch(() => {});
    isConversationActive.current = true;
    startListening();
  };

  const stopConversation = () => {
    isConversationActive.current = false;
    isProcessingRef.current = false;
    abortRef.current?.abort();
    stopRecognition();
    stopAudio();
    setInterimText('');
    setVoiceState('idle');
  };

  const handleInterruptAndSpeak = () => {
    stopAudio();
    isConversationActive.current = true;
    startListening();
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = textInput.trim();
    if (!clean || voiceState === 'thinking') return;
    setTextInput('');
    processUserTurn(clean, isConversationActive.current);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 md:p-8 bg-zinc-950 text-zinc-100">
      <header className="w-full max-w-2xl flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Asistente Conversacional IA</h1>
            <p className="text-xs text-zinc-400">Gemini 3.8 Flash · File Search · Chirp 3 HD</p>
          </div>
        </div>

        <span
          className={`text-xs px-3 py-1 rounded-full font-medium border ${
            voiceState === 'listening'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              : voiceState === 'thinking'
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : voiceState === 'speaking'
              ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
          }`}
        >
          {voiceState === 'listening' && 'Escuchando...'}
          {voiceState === 'thinking' && 'Pensando...'}
          {voiceState === 'speaking' && 'Hablando...'}
          {voiceState === 'idle' && 'En espera'}
        </span>
      </header>

      <main className="w-full max-w-2xl flex-1 my-4 overflow-y-auto space-y-3 pr-1 max-h-[52vh]">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 text-zinc-500">
            <p className="text-base text-zinc-300 font-medium mb-1">
              Presiona el botón para conversar por voz
            </p>
            <p className="text-sm max-w-md">
              La IA responderá con voz natural y volverá a escuchar automáticamente al terminar cada turno.
            </p>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-sm'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {interimText && (
          <div className="flex justify-end">
            <div className="max-w-[82%] rounded-2xl px-4 py-2.5 text-sm italic bg-emerald-950/60 border border-emerald-700/40 text-emerald-200">
              {interimText}...
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </main>

      <footer className="w-full max-w-2xl space-y-4 border-t border-zinc-800 pt-5">
        {errorMsg && (
          <div className="text-xs text-red-300 bg-red-950/50 border border-red-800/60 rounded-xl px-4 py-2.5">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          {voiceState === 'idle' ? (
            <button
              onClick={startConversation}
              className="flex items-center gap-3 px-7 py-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-base shadow-lg shadow-emerald-500/20 transition"
            >
              <Mic className="w-5 h-5" />
              Iniciar conversación por voz
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {voiceState === 'speaking' && (
                <button
                  onClick={handleInterruptAndSpeak}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition"
                >
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  Interrumpir y hablar
                </button>
              )}

              <button
                onClick={stopConversation}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-200 font-semibold text-sm transition"
              >
                {voiceState === 'thinking' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4 fill-current" />
                )}
                Terminar conversación
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="O escribe un mensaje aquí para probar..."
            className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!textInput.trim() || voiceState === 'thinking'}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 transition"
            aria-label="Enviar mensaje"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}

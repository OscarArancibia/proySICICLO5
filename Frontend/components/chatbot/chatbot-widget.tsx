"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Bot,
  Send,
  Mic,
  X,
  Loader2,
  FileText,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { chatbotApi, ApiError } from "@/lib/Ciclo4api";

interface TableData {
  columnas: string[];
  filas: Record<string, unknown>[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  table?: TableData;
  titulo?: string;
}

const ROLES_PERMITIDOS = ["SuperUsuario", "Director", "Administrativo"];
const esMobil = /Mobi|Android/i.test(navigator.userAgent);
const SUGERENCIAS = [
  "Dame la lista completa del plantel docente",
  "¿Qué estudiantes tienen deudas pendientes?",
  "¿Cuáles son los materiales con stock bajo?",
  "¿En qué aula pasa clases el Segundo B?",
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ChatbotWidget() {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const baseTranscriptRef = useRef("");

  // Gating por rol (cliente). El backend también valida.
  useEffect(() => {
    const rol = localStorage.getItem("userNombreRol") || "";
    setAllowed(ROLES_PERMITIDOS.includes(rol));
  }, []);

  // Inicializar Web Speech API
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSpeechSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = !esMobil;

    recognition.onresult = (event: any) => {
      let finalTexto = "";
      let interimTexto = "";

      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTexto += transcript;
        } else {
          interimTexto += transcript;
        }
      }

      // Final acumulado + interim actual (sin duplicar)
      baseTranscriptRef.current = finalTexto;
      setInput((finalTexto + interimTexto).trim());
    };
    recognition.onerror = (event: any) => {
      setListening(false);
      if (event.error !== "no-speech" && event.error !== "aborted") {
        toast.error("Error en el reconocimiento de voz.");
      }
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  // Autoscroll al final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const toggleMic = () => {
    if (!speechSupported) {
      pushAssistant({
        text: "El reconocimiento de voz no está disponible en tu navegador. Por favor usa Chrome, Edge o Safari, o escribe tu pregunta.",
      });
      return;
    }
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      baseTranscriptRef.current = input ? input + " " : "";
      try {
        recognition.start();
        setListening(true);
      } catch {
        /* ya iniciado */
      }
    }
  };

  const pushAssistant = (m: Partial<ChatMessage>) =>
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "assistant", text: "", ...m },
    ]);

  const enviar = async (texto?: string) => {
    const pregunta = (texto ?? input).trim();
    if (!pregunta || loading) return;

    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
      setListening(false);
    }

    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text: pregunta },
    ]);
    setInput("");
    setLoading(true);

    try {
      const res = await chatbotApi.consultar(pregunta);
      if (res.tipo === "ok") {
        pushAssistant({
          titulo: res.titulo,
          text: res.respuesta || res.titulo || "Aquí está el resultado:",
          table:
            res.columnas && res.filas && res.filas.length
              ? { columnas: res.columnas, filas: res.filas }
              : undefined,
        });
      } else {
        // vacio | fuera_alcance | bloqueada | error
        pushAssistant({ text: res.message || "Sin resultados." });
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        pushAssistant({
          text:
            e.status === 401
              ? "Su sesión ha expirado. Por favor, inicie sesión nuevamente."
              : "No tiene permiso para usar el asistente.",
        });
      } else {
        pushAssistant({
          text: "El asistente no está disponible en este momento. Por favor, intente de nuevo más tarde.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const exportar = async (msg: ChatMessage, formato: "pdf" | "csv") => {
    if (!msg.table) return;
    try {
      await chatbotApi.exportar({
        titulo: msg.titulo || "Consulta",
        columnas: msg.table.columnas,
        filas: msg.table.filas,
        formato,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al exportar el resultado.",
      );
    }
  };

  if (!allowed) return null;

  return (
    <>
      {/* Botón flotante (esquina inferior izquierda) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <Bot className="h-7 w-7" />
        </button>
      )}

      {/* Panel de chat */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(600px,80vh)] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">
                  Asistente FMS
                </p>
                <p className="text-xs text-primary-foreground/80">
                  Consultas en lenguaje natural
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="space-y-3 py-4">
                <div className="flex flex-col items-center text-center text-muted-foreground">
                  <Sparkles className="mb-2 h-8 w-8 text-primary" />
                  <p className="text-sm font-medium">
                    Pregúntame sobre el colegio
                  </p>
                  <p className="text-xs">
                    Estudiantes, cursos, pagos, inventario, entregas…
                  </p>
                </div>
                <div className="space-y-2">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      onClick={() => enviar(s)}
                      className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm",
                  )}
                >
                  {m.titulo && m.role === "assistant" && (
                    <p className="mb-1 font-semibold">{m.titulo}</p>
                  )}
                  {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}

                  {m.table && (
                    <div className="mt-2">
                      <ResultTable table={m.table} />
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => exportar(m, "pdf")}
                        >
                          <FileText className="h-3 w-3" /> PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => exportar(m, "csv")}
                        >
                          <FileSpreadsheet className="h-3 w-3" /> CSV
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pensando…
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3">
            {listening && (
              <div className="mb-2 flex items-center gap-2 text-xs text-destructive">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
                Escuchando… habla ahora
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant={listening ? "destructive" : "outline"}
                className="shrink-0"
                onClick={toggleMic}
                aria-label="Entrada por voz"
                disabled={!speechSupported}
                title={
                  speechSupported
                    ? "Hablar"
                    : "Reconocimiento de voz no disponible en este navegador"
                }
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                placeholder="Escribe tu pregunta…"
                disabled={loading}
              />
              <Button
                type="button"
                size="icon"
                className="shrink-0"
                onClick={() => enviar()}
                disabled={loading || !input.trim()}
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {!speechSupported && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Voz no disponible aquí — usa Chrome, Edge o Safari.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ResultTable({ table }: { table: TableData }) {
  const filas = table.filas.slice(0, 50);
  return (
    <div className="max-h-60 overflow-auto rounded-md border bg-background">
      <table className="w-full text-left text-[11px]">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {table.columnas.map((c) => (
              <th key={c} className="px-2 py-1 font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-t">
              {table.columnas.map((c) => (
                <td key={c} className="px-2 py-1 whitespace-nowrap">
                  {formatCell(fila[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.filas.length > 50 && (
        <p className="px-2 py-1 text-[10px] text-muted-foreground">
          Mostrando 50 de {table.filas.length} filas. Exporta para ver todo.
        </p>
      )}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Send, X, Video, MapPin, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  citasApi,
  Cita,
  CitaProfesor,
  CitaTutor,
  HorarioDisponible,
} from "@/lib/Ciclo4api";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hhmm = (t: string) => (t ? t.slice(0, 5) : "");
const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-BO") : "—";

const estadoCita: Record<string, string> = {
  pendiente: "bg-warning/10 text-warning-foreground",
  confirmada: "bg-success/10 text-success",
  realizada: "bg-muted text-muted-foreground",
  cancelada: "bg-destructive/10 text-destructive",
  alternativa: "bg-blue-500/10 text-blue-600",
};

export default function MisCitasPage() {
  const [profesores, setProfesores] = useState<CitaProfesor[]>([]);
  const [tutores, setTutores] = useState<CitaTutor[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);

  const [profesorId, setProfesorId] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [horarios, setHorarios] = useState<HorarioDisponible[]>([]);
  const [horarioId, setHorarioId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargarCitas = () =>
    citasApi
      .listar()
      .then(setCitas)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"));

  useEffect(() => {
    Promise.all([citasApi.misProfesores(), citasApi.misTutores(), citasApi.listar()])
      .then(([p, t, c]) => {
        setProfesores(p);
        setTutores(t);
        setCitas(c);
        if (t.length === 1) setTutorId(String(t[0].id_tutor));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, []);

  // Cargar horarios al elegir profesor
  useEffect(() => {
    setHorarioId("");
    if (!profesorId) {
      setHorarios([]);
      return;
    }
    citasApi
      .horariosDisponibles(Number(profesorId))
      .then(setHorarios)
      .catch(() => setHorarios([])); // 404 = sin horarios
  }, [profesorId]);

  const solicitar = async () => {
    if (!profesorId || !tutorId || !horarioId || !motivo.trim()) {
      return toast.error("Completa profesor, tutor, horario y motivo");
    }
    setEnviando(true);
    try {
      const r = await citasApi.solicitar({
        id_horario_atencion: Number(horarioId),
        motivo: motivo.trim(),
        id_tutor: Number(tutorId),
      });
      toast.success(r.mensaje || "Cita solicitada");
      setHorarioId("");
      setMotivo("");
      const hs = await citasApi.horariosDisponibles(Number(profesorId)).catch(() => []);
      setHorarios(hs);
      cargarCitas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al solicitar");
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async (idCita: number) => {
    try {
      const r = await citasApi.cancelar(idCita);
      toast.success(r.mensaje);
      cargarCitas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const aceptar = async (idCita: number) => {
    try {
      const r = await citasApi.aceptarAlternativa(idCita);
      toast.success(r.mensaje);
      cargarCitas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarClock className="h-6 w-6 text-primary" />
          Reuniones con profesores
        </h1>
        <p className="text-muted-foreground">
          Solicita una reunión en los horarios de atención disponibles.
        </p>
      </div>

      {/* Solicitar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Solicitar reunión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Profesor</Label>
              <Select value={profesorId} onValueChange={setProfesorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un profesor" />
                </SelectTrigger>
                <SelectContent>
                  {profesores.map((p) => (
                    <SelectItem key={p.id_profesor} value={String(p.id_profesor)}>
                      {p.nombre} {p.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tutor que asiste</Label>
              <Select value={tutorId} onValueChange={setTutorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tutor" />
                </SelectTrigger>
                <SelectContent>
                  {tutores.map((t) => (
                    <SelectItem key={t.id_tutor} value={String(t.id_tutor)}>
                      {t.nombre} {t.apellido} ({t.parentesco})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Horario disponible</Label>
            <Select
              value={horarioId}
              onValueChange={setHorarioId}
              disabled={!profesorId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !profesorId
                      ? "Primero elige un profesor"
                      : horarios.length === 0
                        ? "Sin horarios disponibles"
                        : "Selecciona un bloque"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {horarios.map((h) => (
                  <SelectItem
                    key={h.id_horario_atencion}
                    value={String(h.id_horario_atencion)}
                  >
                    {cap(h.dia_semana)} {hhmm(h.hora_inicio)}–{hhmm(h.hora_fin)} ·{" "}
                    {h.modalidad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {profesorId && horarios.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Este profesor no tiene horarios libres. Comunícate por el módulo de
                avisos.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Motivo de la reunión</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Consultar el rendimiento en matemáticas."
            />
          </div>

          <Button onClick={solicitar} disabled={enviando} className="gap-2">
            <Send className="h-4 w-4" />
            {enviando ? "Enviando..." : "Solicitar reunión"}
          </Button>
        </CardContent>
      </Card>

      {/* Mis citas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mis reuniones</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : citas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no tienes reuniones solicitadas.
            </p>
          ) : (
            <div className="space-y-3">
              {citas.map((c) => (
                <div key={c.id_cita} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 font-medium">
                        {c.modalidad === "virtual" ? (
                          <Video className="h-3.5 w-3.5" />
                        ) : (
                          <MapPin className="h-3.5 w-3.5" />
                        )}
                        Prof. {c.profesor_nombre} {c.profesor_apellido}
                      </p>
                      <p className="text-sm text-muted-foreground">{c.motivo}</p>
                      <p className="text-xs text-muted-foreground">
                        {cap(c.dia_semana)} {hhmm(c.hora_inicio)}–{hhmm(c.hora_fin)} ·{" "}
                        {fmtFecha(c.fecha_cita)}
                      </p>
                      {c.estado === "alternativa" && (
                        <p className="text-xs text-blue-600">
                          El profesor propuso este horario alternativo
                          {c.mensaje_alternativa ? `: "${c.mensaje_alternativa}"` : ""}.
                        </p>
                      )}
                      {c.estado === "confirmada" && c.enlace_videollamada && (
                        <a
                          href={c.enlace_videollamada}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline"
                        >
                          Enlace de videollamada
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={estadoCita[c.estado]}>
                        {cap(c.estado)}
                      </Badge>
                      {c.estado === "alternativa" && (
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => aceptar(c.id_cita)}
                        >
                          <Check className="h-4 w-4" /> Aceptar
                        </Button>
                      )}
                      {(c.estado === "pendiente" ||
                        c.estado === "confirmada" ||
                        c.estado === "alternativa") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => cancelar(c.id_cita)}
                        >
                          <X className="h-4 w-4" /> Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

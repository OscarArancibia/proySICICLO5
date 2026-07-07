"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarClock,
  Check,
  X,
  Repeat,
  Plus,
  Video,
  MapPin,
  Eye,
} from "lucide-react";
import {
  citasApi,
  Cita,
  MiHorario,
  ModalidadCita,
  DIAS_SEMANA,
} from "@/lib/Ciclo4api";
import { estructuraApi, Profesor } from "@/lib/ciclo2Api";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-BO") : "—";
const hhmm = (t: string) => (t ? t.slice(0, 5) : "");

const estadoCita: Record<string, string> = {
  pendiente: "bg-warning/10 text-warning-foreground",
  confirmada: "bg-success/10 text-success",
  realizada: "bg-muted text-muted-foreground",
  cancelada: "bg-destructive/10 text-destructive",
  alternativa: "bg-info/10 text-info",
};

function DetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default function CitasDashboardPage() {
  const [role, setRole] = useState<number | null>(null);
  useEffect(() => {
    const r = localStorage.getItem("userRole");
    setRole(r ? parseInt(r, 10) : null);
  }, []);

  if (role === null) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Cargando...
      </p>
    );
  }
  return role === 3 ? <CitasProfesor /> : <CitasDirector />;
}

// ── Vista PROFESOR ────────────────────────────────────────────────────────────
function CitasProfesor() {
  const [horarios, setHorarios] = useState<MiHorario[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(false);

  // Form nuevo horario
  const [dia, setDia] = useState("lunes");
  const [ini, setIni] = useState("");
  const [fin, setFin] = useState("");
  const [modalidad, setModalidad] = useState<ModalidadCita>("presencial");
  const [enlace, setEnlace] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Diálogo de alternativa
  const [altCita, setAltCita] = useState<Cita | null>(null);
  const [altHorario, setAltHorario] = useState("");
  const [altMensaje, setAltMensaje] = useState("");
  const [enviandoAlt, setEnviandoAlt] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const [h, c] = await Promise.all([citasApi.misHorarios(), citasApi.listar()]);
      setHorarios(h);
      setCitas(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    cargar();
  }, []);

  const registrar = async () => {
    if (!ini || !fin) return toast.error("Indique hora de inicio y fin");
    if (ini >= fin) return toast.error("La hora de fin debe ser mayor a la de inicio");
    if (modalidad === "virtual" && !enlace.trim())
      return toast.error("Indique el enlace de videollamada");
    setGuardando(true);
    try {
      await citasApi.registrarHorario({
        dia_semana: dia,
        hora_inicio: ini,
        hora_fin: fin,
        modalidad,
        enlace_videollamada: modalidad === "virtual" ? enlace.trim() : undefined,
      });
      toast.success("Horario de atención registrado");
      setIni("");
      setFin("");
      setEnlace("");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar");
    } finally {
      setGuardando(false);
    }
  };

  const accion = async (fn: Promise<{ mensaje: string }>) => {
    try {
      const r = await fn;
      toast.success(r.mensaje);
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const enviarAlternativa = async () => {
    if (!altCita || !altHorario) return;
    setEnviandoAlt(true);
    try {
      await citasApi.proponerAlternativa(altCita.id_cita, {
        id_horario_atencion_alternativo: Number(altHorario),
        mensaje_alternativa: altMensaje.trim() || undefined,
      });
      toast.success("Horario alternativo propuesto");
      setAltCita(null);
      setAltHorario("");
      setAltMensaje("");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setEnviandoAlt(false);
    }
  };

  const horariosLibres = horarios.filter(
    (h) => h.estado === "disponible" && !h.ocupado,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis Horarios de Atención</h1>
        <p className="text-muted-foreground">
          Publica tus bloques para reuniones con padres y gestiona las solicitudes.
        </p>
      </div>

      {/* Registrar horario */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Publicar disponibilidad</CardTitle>
          <CardDescription>
            El bloque no debe coincidir con tus clases (se valida automáticamente).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label>Día</Label>
              <Select value={dia} onValueChange={setDia}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map((d) => (
                    <SelectItem key={d} value={d}>
                      {cap(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Inicio</Label>
              <Input type="time" value={ini} onChange={(e) => setIni(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fin</Label>
              <Input type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Modalidad</Label>
              <Select
                value={modalidad}
                onValueChange={(v) => setModalidad(v as ModalidadCita)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={registrar} disabled={guardando} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                {guardando ? "..." : "Agregar"}
              </Button>
            </div>
          </div>
          {modalidad === "virtual" && (
            <div className="mt-3 space-y-1">
              <Label>Enlace de videollamada</Label>
              <Input
                placeholder="https://meet..."
                value={enlace}
                onChange={(e) => setEnlace(e.target.value)}
              />
            </div>
          )}

          {/* Lista de horarios */}
          <div className="mt-4 flex flex-wrap gap-2">
            {horarios.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin horarios publicados.</p>
            ) : (
              horarios.map((h) => (
                <Badge
                  key={h.id_horario_atencion}
                  variant="outline"
                  className="gap-1 py-1"
                >
                  {h.modalidad === "virtual" ? (
                    <Video className="h-3 w-3" />
                  ) : (
                    <MapPin className="h-3 w-3" />
                  )}
                  {cap(h.dia_semana)} {hhmm(h.hora_inicio)}–{hhmm(h.hora_fin)}
                  {h.ocupado && (
                    <span className="ml-1 text-warning-foreground">(con cita)</span>
                  )}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Solicitudes / citas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-5 w-5" />
            Solicitudes de reunión
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : citas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tienes solicitudes de cita.
            </p>
          ) : (
            <div className="space-y-3">
              {citas.map((c) => (
                <div key={c.id_cita} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {c.tutor_nombre} {c.tutor_apellido}{" "}
                        <span className="text-xs text-muted-foreground">
                          (est. {c.estudiante_nombre} {c.estudiante_apellido})
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">{c.motivo}</p>
                      <p className="text-xs text-muted-foreground">
                        {cap(c.dia_semana)} {hhmm(c.hora_inicio)}–{hhmm(c.hora_fin)} ·{" "}
                        {c.modalidad} · {fmtFecha(c.fecha_cita)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={estadoCita[c.estado]}>
                        {cap(c.estado)}
                      </Badge>
                      {c.estado === "pendiente" && (
                        <>
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() => accion(citasApi.confirmar(c.id_cita))}
                          >
                            <Check className="h-4 w-4" /> Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => {
                              setAltCita(c);
                              setAltHorario("");
                              setAltMensaje("");
                            }}
                          >
                            <Repeat className="h-4 w-4" /> Alternativa
                          </Button>
                        </>
                      )}
                      {c.estado === "confirmada" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => accion(citasApi.cancelar(c.id_cita))}
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

      {/* Diálogo alternativa */}
      <Dialog open={altCita !== null} onOpenChange={(o) => !o && setAltCita(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proponer horario alternativo</DialogTitle>
            <DialogDescription>
              Elige uno de tus bloques libres y (opcional) un mensaje para el tutor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nuevo bloque</Label>
              <Select value={altHorario} onValueChange={setAltHorario}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar bloque libre" />
                </SelectTrigger>
                <SelectContent>
                  {horariosLibres.map((h) => (
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
              {horariosLibres.length === 0 && (
                <p className="text-xs text-destructive">
                  No tienes bloques libres. Publica uno primero.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Mensaje (opcional)</Label>
              <Textarea
                value={altMensaje}
                onChange={(e) => setAltMensaje(e.target.value)}
                placeholder="Ej: Ese día no puedo, ¿podemos el jueves?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAltCita(null)}>
              Cancelar
            </Button>
            <Button onClick={enviarAlternativa} disabled={!altHorario || enviandoAlt}>
              {enviandoAlt ? "Enviando..." : "Proponer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Vista DIRECTOR ────────────────────────────────────────────────────────────
function CitasDirector() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState("");
  const [profesorId, setProfesorId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [detalle, setDetalle] = useState<Cita | null>(null);

  useEffect(() => {
    estructuraApi
      .getProfesores()
      .then(setProfesores)
      .catch(() => {});
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      setCitas(
        await citasApi.listar({
          estado: estado || undefined,
          id_profesor: profesorId || undefined,
          fecha_desde: desde || undefined,
          fecha_hasta: hasta || undefined,
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, profesorId, desde, hasta]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Citas de Atención</h1>
        <p className="text-muted-foreground">
          Listado de todas las reuniones entre profesores y tutores.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select
                value={estado || "todos"}
                onValueChange={(v) => setEstado(v === "todos" ? "" : v)}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="confirmada">Confirmada</SelectItem>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="alternativa">Alternativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Profesor</Label>
              <Select
                value={profesorId || "todos"}
                onValueChange={(v) => setProfesorId(v === "todos" ? "" : v)}
              >
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {profesores.map((p) => (
                    <SelectItem key={p.id_profesor} value={String(p.id_profesor)}>
                      {p.nombre} {p.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : citas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay citas registradas.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Profesor</TableHead>
                    <TableHead>Tutor</TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Bloque</TableHead>
                    <TableHead>Modalidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {citas.map((c) => (
                    <TableRow key={c.id_cita}>
                      <TableCell className="whitespace-nowrap">
                        {fmtFecha(c.fecha_cita)}
                      </TableCell>
                      <TableCell>
                        {c.profesor_nombre} {c.profesor_apellido}
                      </TableCell>
                      <TableCell>
                        {c.tutor_nombre} {c.tutor_apellido}
                      </TableCell>
                      <TableCell>
                        {c.estudiante_nombre} {c.estudiante_apellido}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {cap(c.dia_semana)} {hhmm(c.hora_inicio)}–{hhmm(c.hora_fin)}
                      </TableCell>
                      <TableCell className="capitalize">{c.modalidad}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={estadoCita[c.estado]}>
                          {cap(c.estado)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setDetalle(c)}
                        >
                          <Eye className="h-4 w-4" /> Detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle de la cita */}
      <Dialog open={detalle !== null} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de la cita</DialogTitle>
            <DialogDescription>Información completa de la reunión.</DialogDescription>
          </DialogHeader>
          {detalle && (
            <div className="space-y-2 py-2 text-sm">
              <DetRow
                label="Profesor"
                value={`${detalle.profesor_nombre} ${detalle.profesor_apellido}`}
              />
              <DetRow
                label="Tutor"
                value={`${detalle.tutor_nombre} ${detalle.tutor_apellido}`}
              />
              <DetRow
                label="Estudiante"
                value={`${detalle.estudiante_nombre} ${detalle.estudiante_apellido}`}
              />
              <DetRow label="Fecha" value={fmtFecha(detalle.fecha_cita)} />
              <DetRow
                label="Horario"
                value={`${cap(detalle.dia_semana)} ${hhmm(detalle.hora_inicio)}–${hhmm(detalle.hora_fin)}`}
              />
              <DetRow label="Modalidad" value={cap(detalle.modalidad)} />
              <DetRow label="Estado" value={cap(detalle.estado)} />
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground">Motivo</p>
                <p>{detalle.motivo}</p>
              </div>
              {detalle.mensaje_alternativa && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Mensaje de alternativa
                  </p>
                  <p>{detalle.mensaje_alternativa}</p>
                </div>
              )}
              {detalle.enlace_videollamada && (
                <div>
                  <p className="text-xs text-muted-foreground">Enlace</p>
                  <a
                    href={detalle.enlace_videollamada}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-primary underline"
                  >
                    {detalle.enlace_videollamada}
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  Plus,
  Undo2,
  Users,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  licenciasApi,
  reemplazosApi,
  TIPOS_LICENCIA,
  Licencia,
  ProfesorConLicencia,
  MateriaSinCobertura,
  SuplenteDisponible,
} from "@/lib/licenciasApi";
import { estructuraApi, Profesor } from "@/lib/ciclo2Api";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-BO") : "—";
const hhmm = (t: string) => (t ? t.slice(0, 5) : "");

const estadoLic: Record<string, string> = {
  pendiente: "bg-warning/10 text-warning-foreground",
  pendiente_doc: "bg-warning/10 text-warning-foreground",
  aprobada: "bg-success/10 text-success",
  rechazada: "bg-destructive/10 text-destructive",
  cerrada: "bg-muted text-muted-foreground",
  cancelada: "bg-muted text-muted-foreground",
};

const labelEstado: Record<string, string> = {
  pendiente: "Pendiente",
  pendiente_doc: "Pendiente doc.",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

export default function LicenciasPage() {
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
  if (role === 3) return <LicenciasProfesor />;
  if (role === 4) return <LicenciasAdministrativo />;
  return <LicenciasDirector />;
}

// ── Vista PROFESOR ──────────────────────────────────────────────────────────
function LicenciasProfesor() {
  const [tipo, setTipo] = useState("medica");
  const [ini, setIni] = useState("");
  const [fin, setFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [doc, setDoc] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Historial propio
  const [licencias, setLicencias] = useState<Licencia[]>([]);
  const [loading, setLoading] = useState(false);

  // Extensión
  const [extId, setExtId] = useState("");
  const [extFin, setExtFin] = useState("");
  const [extMotivo, setExtMotivo] = useState("");
  const [extLoading, setExtLoading] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      setLicencias(await licenciasApi.misLicencias());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    cargar();
  }, []);

  const aprobadas = licencias.filter((l) => l.estado === "aprobada");

  const solicitar = async () => {
    if (!ini || !fin || !motivo.trim())
      return toast.error("Complete fechas y motivo");
    if (ini > fin)
      return toast.error(
        "La fecha de inicio no puede ser posterior a la de fin",
      );
    setGuardando(true);
    try {
      const r = await licenciasApi.solicitar({
        tipo_licencia: tipo,
        fecha_inicio: ini,
        fecha_fin: fin,
        motivo: motivo.trim(),
        documento_url: doc.trim() || undefined,
      });
      toast.success(r.mensaje);
      setIni("");
      setFin("");
      setMotivo("");
      setDoc("");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al solicitar");
    } finally {
      setGuardando(false);
    }
  };

  const extender = async () => {
    if (!extId || !extFin || !extMotivo.trim())
      return toast.error("Seleccione la licencia, la nueva fecha y el motivo");
    setExtLoading(true);
    try {
      const r = await licenciasApi.extender(Number(extId), {
        fecha_nuevo_fin: extFin,
        motivo_extension: extMotivo.trim(),
      });
      toast.success(r.mensaje);
      setExtId("");
      setExtFin("");
      setExtMotivo("");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al extender");
    } finally {
      setExtLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Licencias y Permisos
        </h1>
        <p className="text-muted-foreground">
          Solicita una licencia o permiso. El Director será notificado para su
          revisión.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Nueva solicitud</CardTitle>
          <CardDescription>
            En licencia médica sin documento, la solicitud queda pendiente de
            documentación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_LICENCIA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {cap(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input
                type="date"
                value={ini}
                onChange={(e) => setIni(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Documento (URL, opcional)</Label>
              <Input
                placeholder="https://..."
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describa el motivo de la licencia..."
            />
          </div>
          <Button onClick={solicitar} disabled={guardando} className="gap-2">
            <Plus className="h-4 w-4" />
            {guardando ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Solicitar extensión (E3)</CardTitle>
          <CardDescription>
            Amplía una licencia ya aprobada antes de que venza.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Licencia aprobada</Label>
              <Select value={extId} onValueChange={setExtId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      aprobadas.length === 0
                        ? "Sin licencias aprobadas"
                        : "Seleccionar licencia"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {aprobadas.map((l) => (
                    <SelectItem
                      key={l.id_licencia}
                      value={String(l.id_licencia)}
                    >
                      #{l.id_licencia} · {cap(l.tipo_licencia)} ·{" "}
                      {fmtFecha(l.fecha_inicio)}–{fmtFecha(l.fecha_fin)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nueva fecha de fin</Label>
              <Input
                type="date"
                value={extFin}
                onChange={(e) => setExtFin(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Motivo de la extensión</Label>
            <Textarea
              value={extMotivo}
              onChange={(e) => setExtMotivo(e.target.value)}
              placeholder="Motivo por el que necesita más días..."
            />
          </div>
          <Button
            onClick={extender}
            disabled={extLoading || !extId}
            variant="outline"
            className="gap-2"
          >
            <CalendarClock className="h-4 w-4" />
            {extLoading ? "Enviando..." : "Solicitar extensión"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Mis licencias
          </CardTitle>
          <CardDescription>
            Historial de tus solicitudes y su estado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TablaSolicitudes licencias={licencias} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tabla de solicitudes (compartida) ────────────────────────────────────────
function TablaSolicitudes({
  licencias,
  loading,
  acciones,
}: {
  licencias: Licencia[];
  loading: boolean;
  acciones?: (l: Licencia) => React.ReactNode;
}) {
  if (loading)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Cargando...
      </p>
    );
  if (licencias.length === 0)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay solicitudes.
      </p>
    );
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Profesor</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Doc.</TableHead>
            <TableHead>Estado</TableHead>
            {acciones && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {licencias.map((l) => (
            <TableRow key={l.id_licencia}>
              <TableCell>{l.id_licencia}</TableCell>
              <TableCell className="whitespace-nowrap">
                {l.nombre} {l.apellido}
              </TableCell>
              <TableCell className="capitalize">{l.tipo_licencia}</TableCell>
              <TableCell className="whitespace-nowrap">
                {fmtFecha(l.fecha_inicio)} – {fmtFecha(l.fecha_fin)}
                {l.fecha_fin_real && (
                  <span className="block text-xs text-muted-foreground">
                    Retorno: {fmtFecha(l.fecha_fin_real)}
                  </span>
                )}
              </TableCell>
              <TableCell className="max-w-[16rem] truncate" title={l.motivo}>
                {l.motivo}
              </TableCell>
              <TableCell>
                {l.documento_url ? (
                  <a
                    href={l.documento_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    <FileText className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={estadoLic[l.estado]}>
                  {labelEstado[l.estado] || l.estado}
                </Badge>
              </TableCell>
              {acciones && <TableCell>{acciones(l)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Filtros (compartidos) ─────────────────────────────────────────────────────
function FiltrosSolicitudes({
  estado,
  setEstado,
  desde,
  setDesde,
  hasta,
  setHasta,
}: {
  estado: string;
  setEstado: (v: string) => void;
  desde: string;
  setDesde: (v: string) => void;
  hasta: string;
  setHasta: (v: string) => void;
}) {
  return (
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
            <SelectItem value="pendiente_doc">Pendiente doc.</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
            <SelectItem value="cerrada">Cerrada</SelectItem>
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
  );
}

// ── Vista DIRECTOR ────────────────────────────────────────────────────────────
function LicenciasDirector() {
  const [licencias, setLicencias] = useState<Licencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // Diálogo de acción (aprobar / rechazar / retornar)
  const [accion, setAccion] = useState<{
    tipo: "aprobar" | "rechazar" | "retornar";
    lic: Licencia;
  } | null>(null);
  const [texto, setTexto] = useState("");
  const [procesando, setProcesando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      setLicencias(
        await licenciasApi.listar({
          estado: estado || undefined,
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
  }, [estado, desde, hasta]);

  const confirmarAccion = async () => {
    if (!accion) return;
    const { tipo, lic } = accion;
    if (tipo === "rechazar" && !texto.trim())
      return toast.error("Debe indicar el motivo del rechazo");
    if (tipo === "retornar" && !texto)
      return toast.error("Debe indicar la fecha de retorno");
    setProcesando(true);
    try {
      const r =
        tipo === "aprobar"
          ? await licenciasApi.aprobar(
              lic.id_licencia,
              texto.trim() || undefined,
            )
          : tipo === "rechazar"
            ? await licenciasApi.rechazar(lic.id_licencia, texto.trim())
            : await licenciasApi.retornar(lic.id_licencia, texto);
      toast.success(r.mensaje);
      setAccion(null);
      setTexto("");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Licencias y Permisos
        </h1>
        <p className="text-muted-foreground">
          Revisa, aprueba o rechaza solicitudes y gestiona suplentes.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <FiltrosSolicitudes
            estado={estado}
            setEstado={setEstado}
            desde={desde}
            setDesde={setDesde}
            hasta={hasta}
            setHasta={setHasta}
          />
        </CardHeader>
        <CardContent>
          <TablaSolicitudes
            licencias={licencias}
            loading={loading}
            acciones={(l) =>
              l.estado === "pendiente" || l.estado === "pendiente_doc" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      setAccion({ tipo: "aprobar", lic: l });
                      setTexto("");
                    }}
                  >
                    <Check className="h-4 w-4" /> Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      setAccion({ tipo: "rechazar", lic: l });
                      setTexto("");
                    }}
                  >
                    <X className="h-4 w-4" /> Rechazar
                  </Button>
                </div>
              ) : l.estado === "aprobada" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    setAccion({ tipo: "retornar", lic: l });
                    setTexto("");
                  }}
                >
                  <Undo2 className="h-4 w-4" /> Retorno
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )
            }
          />
        </CardContent>
      </Card>

      <ReemplazosDirector />

      {/* Diálogo de acción */}
      <Dialog
        open={accion !== null}
        onOpenChange={(o) => !o && setAccion(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {accion?.tipo === "aprobar"
                ? "Aprobar licencia"
                : accion?.tipo === "rechazar"
                  ? "Rechazar licencia"
                  : "Registrar retorno anticipado"}
            </DialogTitle>
            <DialogDescription>
              {accion &&
                `${accion.lic.nombre} ${accion.lic.apellido} · ${fmtFecha(
                  accion.lic.fecha_inicio,
                )} – ${fmtFecha(accion.lic.fecha_fin)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {accion?.tipo === "retornar" ? (
              <>
                <Label>Fecha de retorno</Label>
                <Input
                  type="date"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
              </>
            ) : (
              <>
                <Label>
                  {accion?.tipo === "rechazar"
                    ? "Motivo del rechazo (obligatorio)"
                    : "Comentario (opcional)"}
                </Label>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={
                    accion?.tipo === "rechazar"
                      ? "Explique por qué se rechaza..."
                      : "Comentario para el profesor..."
                  }
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccion(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarAccion} disabled={procesando}>
              {procesando ? "Procesando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Reemplazos (Director) ─────────────────────────────────────────────────────
function ReemplazosDirector() {
  const [profesores, setProfesores] = useState<ProfesorConLicencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<ProfesorConLicencia | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      setProfesores(await licenciasApi.profesoresConLicencia());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    cargar();
  }, []);

  const hayAlerta = profesores.length > 0;

  return (
    <Card className={hayAlerta ? "border-warning/50 bg-warning/5" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {hayAlerta ? (
            <AlertTriangle className="h-5 w-5 text-warning-foreground" />
          ) : (
            <Users className="h-5 w-5" />
          )}
          Profesores con licencia aprobada
          {hayAlerta && (
            <Badge
              variant="secondary"
              className="bg-warning/10 text-warning-foreground"
            >
              {profesores.length} con materias por cubrir
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Licencias aprobadas vigentes o próximas. Asigna suplentes para las
          materias sin cobertura.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Cargando...
          </p>
        ) : profesores.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay licencias aprobadas pendientes de cobertura.
          </p>
        ) : (
          <div className="space-y-2">
            {profesores.map((p) => (
              <div
                key={p.id_licencia}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">
                    {p.nombre} {p.apellido}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtFecha(p.fecha_inicio)} – {fmtFecha(p.fecha_fin)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSel(p)}>
                  Gestionar suplentes
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ReemplazoDialog profesor={sel} onClose={() => setSel(null)} />
    </Card>
  );
}

function ReemplazoDialog({
  profesor,
  onClose,
}: {
  profesor: ProfesorConLicencia | null;
  onClose: () => void;
}) {
  const [materias, setMaterias] = useState<MateriaSinCobertura[]>([]);
  const [loading, setLoading] = useState(false);
  const [materiaSel, setMateriaSel] = useState<MateriaSinCobertura | null>(
    null,
  );
  const [suplentes, setSuplentes] = useState<SuplenteDisponible[]>([]);
  const [cargandoSup, setCargandoSup] = useState(false);
  const [suplenteId, setSuplenteId] = useState("");
  const [asignando, setAsignando] = useState(false);
  const [aplicarATodas, setAplicarATodas] = useState(false);

  const cargarMaterias = async (idLic: number) => {
    setLoading(true);
    try {
      setMaterias(await reemplazosApi.materiasSinCobertura(idLic));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar materias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMateriaSel(null);
    setSuplentes([]);
    setSuplenteId("");
    setAplicarATodas(false);
    if (profesor) cargarMaterias(profesor.id_licencia);
    else setMaterias([]);
  }, [profesor]);

  const buscarSuplentes = async (m: MateriaSinCobertura) => {
    if (!profesor) return;
    setMateriaSel(m);
    setSuplenteId("");
    setCargandoSup(true);
    try {
      setSuplentes(
        await reemplazosApi.sugerirSuplentes(profesor.id_licencia, {
          dia_semana: m.dia_semana,
          hora_inicio: m.hora_inicio,
          hora_fin: m.hora_fin,
        }),
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al sugerir suplentes",
      );
    } finally {
      setCargandoSup(false);
    }
  };

  const asignar = async () => {
    if (!profesor || !materiaSel || !suplenteId) return;
    setAsignando(true);
    try {
      if (aplicarATodas) {
        // Deduplicar por curso_materia (la lista trae una fila por bloque)
        const unicas = Array.from(
          new Map(materias.map((m) => [m.id_curso_materia, m])).values(),
        );
        const results = await Promise.allSettled(
          unicas.map((m) =>
            reemplazosApi.asignar({
              idLicencia: profesor.id_licencia,
              idCursoMateria: m.id_curso_materia,
              idProfesorSuplente: Number(suplenteId),
            }),
          ),
        );
        const ok = results.filter((r) => r.status === "fulfilled").length;
        const fail = results.length - ok;
        toast.success(
          `Asignadas ${ok} materia(s)${
            fail ? ` · ${fail} con conflicto de horario` : ""
          }`,
        );
      } else {
        const r = await reemplazosApi.asignar({
          idLicencia: profesor.id_licencia,
          idCursoMateria: materiaSel.id_curso_materia,
          idProfesorSuplente: Number(suplenteId),
        });
        toast.success(r.mensaje);
      }
      setMateriaSel(null);
      setSuplentes([]);
      setSuplenteId("");
      setAplicarATodas(false);
      cargarMaterias(profesor.id_licencia);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al asignar");
    } finally {
      setAsignando(false);
    }
  };

  return (
    <Dialog open={profesor !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Suplentes · {profesor?.nombre} {profesor?.apellido}
          </DialogTitle>
          <DialogDescription>
            Materias sin cobertura durante la licencia. Elige un bloque y asigna
            un suplente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Cargando...
            </p>
          ) : materias.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay materias sin cobertura (o ya tienen suplente).
            </p>
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {materias.map((m) => (
                <div
                  key={`${m.id_curso_materia}-${m.dia_semana}-${m.hora_inicio}`}
                  className={`rounded-lg border p-3 ${
                    materiaSel?.id_curso_materia === m.id_curso_materia &&
                    materiaSel?.hora_inicio === m.hora_inicio
                      ? "border-primary"
                      : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {m.nombre_materia}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({m.paralelo})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cap(m.dia_semana)} {hhmm(m.hora_inicio)}–
                        {hhmm(m.hora_fin)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => buscarSuplentes(m)}
                    >
                      Buscar suplentes
                    </Button>
                  </div>

                  {materiaSel?.id_curso_materia === m.id_curso_materia &&
                    materiaSel?.hora_inicio === m.hora_inicio && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Suplente disponible</Label>
                            <Select
                              value={suplenteId}
                              onValueChange={setSuplenteId}
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    cargandoSup
                                      ? "Buscando..."
                                      : suplentes.length === 0
                                        ? "Sin suplentes disponibles"
                                        : "Seleccionar profesor"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {suplentes.map((s) => (
                                  <SelectItem
                                    key={s.id_profesor}
                                    value={String(s.id_profesor)}
                                  >
                                    {s.nombre} {s.apellido}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={asignar}
                            disabled={!suplenteId || asignando}
                          >
                            {asignando
                              ? "Asignando..."
                              : aplicarATodas
                                ? "Asignar a todas"
                                : "Asignar"}
                          </Button>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={aplicarATodas}
                            onChange={(e) => setAplicarATodas(e.target.checked)}
                            className="h-4 w-4 accent-primary"
                          />
                          Aplicar este suplente a todas las materias sin cobertura
                        </label>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Vista ADMINISTRATIVO (Secretaría) ─────────────────────────────────────────
function LicenciasAdministrativo() {
  const [licencias, setLicencias] = useState<Licencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [profId, setProfId] = useState("");
  const [tipo, setTipo] = useState("medica");
  const [ini, setIni] = useState("");
  const [fin, setFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [doc, setDoc] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      setLicencias(
        await licenciasApi.listar({
          estado: estado || undefined,
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
  }, [estado, desde, hasta]);

  useEffect(() => {
    estructuraApi
      .getProfesores()
      .then(setProfesores)
      .catch(() => {});
  }, []);

  const registrar = async () => {
    if (!profId || !ini || !fin || !motivo.trim())
      return toast.error("Complete profesor, fechas y motivo");
    setGuardando(true);
    try {
      const r = await licenciasApi.registrarPorSecretaria({
        id_profesor: Number(profId),
        tipo_licencia: tipo,
        fecha_inicio: ini,
        fecha_fin: fin,
        motivo: motivo.trim(),
        documento_url: doc.trim() || undefined,
      });
      toast.success(r.mensaje);
      setProfId("");
      setIni("");
      setFin("");
      setMotivo("");
      setDoc("");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Licencias y Permisos
        </h1>
        <p className="text-muted-foreground">
          Registra licencias en nombre de un profesor (E5) y consulta las
          solicitudes.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            Registrar por secretaría (E5)
          </CardTitle>
          <CardDescription>
            El Director será notificado para su aprobación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Profesor</Label>
              <Select value={profId} onValueChange={setProfId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {profesores.map((p) => (
                    <SelectItem
                      key={p.id_profesor}
                      value={String(p.id_profesor)}
                    >
                      {p.nombre} {p.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_LICENCIA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {cap(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Documento (URL, opcional)</Label>
              <Input
                placeholder="https://..."
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input
                type="date"
                value={ini}
                onChange={(e) => setIni(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo de la licencia..."
            />
          </div>
          <Button onClick={registrar} disabled={guardando} className="gap-2">
            <Plus className="h-4 w-4" />
            {guardando ? "Registrando..." : "Registrar solicitud"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <FiltrosSolicitudes
            estado={estado}
            setEstado={setEstado}
            desde={desde}
            setDesde={setDesde}
            hasta={hasta}
            setHasta={setHasta}
          />
        </CardHeader>
        <CardContent>
          <TablaSolicitudes licencias={licencias} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}

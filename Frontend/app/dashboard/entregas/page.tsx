"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Baby,
  History,
} from "lucide-react";
import {
  entregasApi,
  ApiError,
  EntregaCurso,
  EntregaEstudiante,
  EntregaListItem,
  TutorAutorizado,
} from "@/lib/Ciclo4api";

interface EntregaRegistrada {
  tutorNombre: string;
  parentesco: string;
  hora: string;
}

const iniciales = (nombre: string, apellido: string) =>
  `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();

const cursoLabel = (c: EntregaCurso) =>
  `${c.nombre_grado} "${c.paralelo}" - ${c.turno}`;

// SuperUsuario, Director, Administrativo → vista de listado (solo lectura)
const ADMIN_ROLES = [1, 2, 4];

export default function EntregasPage() {
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

  return ADMIN_ROLES.includes(role) ? (
    <EntregasAdmin />
  ) : (
    <EntregasOperativas />
  );
}

function EntregasOperativas() {
  const [cursos, setCursos] = useState<EntregaCurso[]>([]);
  const [cursoId, setCursoId] = useState<string>("");
  const [estudiantes, setEstudiantes] = useState<EntregaEstudiante[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [loadingEstudiantes, setLoadingEstudiantes] = useState(false);

  // Entregas registradas en esta sesión (el backend no expone listado del día)
  const [entregas, setEntregas] = useState<
    Record<number, EntregaRegistrada>
  >({});
  // Estudiantes detectados sin tutor autorizado (caso E2)
  const [sinTutor, setSinTutor] = useState<Set<number>>(new Set());

  // Estado del diálogo de entrega
  const [selected, setSelected] = useState<EntregaEstudiante | null>(null);
  const [tutores, setTutores] = useState<TutorAutorizado[]>([]);
  const [tutorId, setTutorId] = useState<string>("");
  const [observaciones, setObservaciones] = useState("");
  const [loadingTutores, setLoadingTutores] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Carga de datos ──────────────────────────────────────────────────────────

  useEffect(() => {
    const loadCursos = async () => {
      setLoadingCursos(true);
      try {
        setCursos(await entregasApi.listarMisCursos());
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Error al cargar cursos",
        );
      } finally {
        setLoadingCursos(false);
      }
    };
    loadCursos();
  }, []);

  const handleCursoChange = async (value: string) => {
    setCursoId(value);
    setEstudiantes([]);
    setEntregas({});
    setSinTutor(new Set());
    setLoadingEstudiantes(true);
    try {
      const [lista, registradas] = await Promise.all([
        entregasApi.listarEstudiantes(Number(value)),
        entregasApi.listarEntregasRegistradas(Number(value)),
      ]);
      setEstudiantes(lista);
      // Reconstruir el estado de entregas ya registradas hoy
      const previas: Record<number, EntregaRegistrada> = {};
      for (const r of registradas) {
        previas[r.id_estudiante] = {
          tutorNombre: `${r.tutor_nombre} ${r.tutor_apellido}`,
          parentesco: r.parentesco ?? "",
          hora: new Date(r.fecha_hora_entrega).toLocaleTimeString("es-BO", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      }
      setEntregas(previas);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cargar estudiantes",
      );
    } finally {
      setLoadingEstudiantes(false);
    }
  };

  // ── Diálogo de entrega ────────────────────────────────────────────────────────

  const abrirEntrega = async (estudiante: EntregaEstudiante) => {
    setSelected(estudiante);
    setTutores([]);
    setTutorId("");
    setObservaciones("");
    setLoadingTutores(true);
    try {
      const data = await entregasApi.listarTutoresAutorizados(
        estudiante.id_estudiante,
      );
      setTutores(data);
      setSinTutor((prev) => {
        const next = new Set(prev);
        next.delete(estudiante.id_estudiante);
        return next;
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Caso E2: estudiante sin tutores autorizados
        setSinTutor((prev) => new Set(prev).add(estudiante.id_estudiante));
      } else {
        toast.error(
          error instanceof Error ? error.message : "Error al cargar tutores",
        );
      }
    } finally {
      setLoadingTutores(false);
    }
  };

  const cerrarDialogo = () => {
    setSelected(null);
    setTutores([]);
    setTutorId("");
    setObservaciones("");
  };

  const confirmarEntrega = async () => {
    if (!selected || !tutorId) return;
    setSaving(true);
    try {
      const res = await entregasApi.registrar({
        id_estudiante: selected.id_estudiante,
        id_tutor: Number(tutorId),
        observaciones: observaciones.trim() || undefined,
      });
      const tutor = tutores.find((t) => t.id_tutor === Number(tutorId));
      const hora = new Date(res.entrega.fecha_hora_entrega).toLocaleTimeString(
        "es-BO",
        { hour: "2-digit", minute: "2-digit" },
      );
      setEntregas((prev) => ({
        ...prev,
        [selected.id_estudiante]: {
          tutorNombre: tutor
            ? `${tutor.nombre} ${tutor.apellido}`
            : "Tutor autorizado",
          parentesco: tutor?.parentesco ?? "",
          hora,
        },
      }));
      toast.success(res.mensaje || "Entrega registrada correctamente");
      cerrarDialogo();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al registrar entrega",
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Derivados ─────────────────────────────────────────────────────────────────

  const filtered = estudiantes.filter((e) =>
    `${e.nombre} ${e.apellido}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  const entregadosCount = Object.keys(entregas).length;
  const pendientesCount = estudiantes.length - entregadosCount;
  const alertCount = sinTutor.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Control de Entregas
          </h1>
          <p className="text-muted-foreground">
            Gestión segura de entrega de estudiantes a tutores autorizados
          </p>
        </div>
        <Select
          value={cursoId}
          onValueChange={handleCursoChange}
          disabled={loadingCursos}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue
              placeholder={loadingCursos ? "Cargando..." : "Seleccionar curso"}
            />
          </SelectTrigger>
          <SelectContent>
            {cursos.map((c) => (
              <SelectItem key={c.id_curso} value={String(c.id_curso)}>
                {cursoLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Alert Card */}
      {alertCount > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  Atención: {alertCount} estudiante(s) sin tutor autorizado
                </p>
                <p className="text-sm text-muted-foreground">
                  No se puede registrar la entrega hasta vincular un tutor
                  autorizado a recoger.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Curso</p>
                <p className="text-2xl font-bold">{estudiantes.length}</p>
              </div>
              <Baby className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-warning-foreground">
                  {estudiantes.length ? pendientesCount : 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-warning/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Entregados</p>
                <p className="text-2xl font-bold text-success">
                  {entregadosCount}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertas</p>
                <p className="text-2xl font-bold text-destructive">
                  {alertCount}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Students List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Estudiantes</CardTitle>
                  <CardDescription>
                    {cursoId
                      ? "Seleccione un estudiante para registrar su entrega"
                      : "Seleccione un curso para ver sus estudiantes"}
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar estudiante..."
                    className="pl-9 w-full sm:w-56"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={!cursoId}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!cursoId ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No hay un curso seleccionado.
                </p>
              ) : loadingEstudiantes ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Cargando estudiantes...
                </p>
              ) : filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No se encontraron estudiantes.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estudiante</TableHead>
                        <TableHead>CI</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[120px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((estudiante) => {
                        const entrega = entregas[estudiante.id_estudiante];
                        const noTutor = sinTutor.has(estudiante.id_estudiante);
                        return (
                          <TableRow key={estudiante.id_estudiante}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                    {iniciales(
                                      estudiante.nombre,
                                      estudiante.apellido,
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">
                                  {estudiante.apellido}, {estudiante.nombre}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {estudiante.ci ?? "—"}
                            </TableCell>
                            <TableCell>
                              {entrega ? (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 bg-success/10 text-success"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Entregado {entrega.hora}
                                </Badge>
                              ) : noTutor ? (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 bg-destructive/10 text-destructive"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Sin tutor
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 bg-warning/10 text-warning-foreground"
                                >
                                  <Clock className="h-3 w-3" />
                                  Pendiente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {entrega ? (
                                <span className="text-xs text-muted-foreground">
                                  {entrega.tutorNombre}
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => abrirEntrega(estudiante)}
                                >
                                  Entregar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Security Info */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Protocolo de Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>1. Verificar identidad del tutor</p>
              <p>2. Confirmar parentesco autorizado</p>
              <p>3. Solicitar documento de identidad</p>
              <p>4. Registrar hora de entrega</p>
            </CardContent>
          </Card>

          {/* Recent Deliveries */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-5 w-5" />
                Últimas Entregas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                {entregadosCount === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aún no hay entregas registradas.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {estudiantes
                      .filter((e) => entregas[e.id_estudiante])
                      .map((e) => {
                        const entrega = entregas[e.id_estudiante];
                        return (
                          <div
                            key={e.id_estudiante}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {e.apellido}, {e.nombre}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {entrega.tutorNombre}
                                {entrega.parentesco
                                  ? ` (${entrega.parentesco})`
                                  : ""}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {entrega.hora}
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de entrega */}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && cerrarDialogo()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Entrega</DialogTitle>
            <DialogDescription>
              Verifique la identidad del tutor autorizado antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {iniciales(selected.nombre, selected.apellido)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {selected.apellido}, {selected.nombre}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    CI: {selected.ci ?? "—"}
                  </p>
                </div>
              </div>

              {loadingTutores ? (
                <p className="text-sm text-muted-foreground">
                  Cargando tutores autorizados...
                </p>
              ) : tutores.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  El estudiante no tiene tutores autorizados registrados (E2).
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Tutor que recoge</Label>
                    <Select value={tutorId} onValueChange={setTutorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tutor autorizado" />
                      </SelectTrigger>
                      <SelectContent>
                        {tutores.map((t) => (
                          <SelectItem
                            key={t.id_tutor}
                            value={String(t.id_tutor)}
                          >
                            {t.nombre} {t.apellido} ({t.parentesco})
                            {t.ci ? ` · CI ${t.ci}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Observaciones (opcional)</Label>
                    <Textarea
                      placeholder="Notas sobre la entrega..."
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={cerrarDialogo}>
              Cancelar
            </Button>
            <Button
              className="gap-2"
              onClick={confirmarEntrega}
              disabled={!tutorId || saving || loadingTutores}
            >
              <Shield className="h-4 w-4" />
              {saving ? "Registrando..." : "Confirmar Entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Vista administrativa: listado global de entregas ──────────────────────────

function EntregasAdmin() {
  const [entregas, setEntregas] = useState<EntregaListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fecha, setFecha] = useState("");

  const load = async (fechaFiltro?: string) => {
    setLoading(true);
    try {
      setEntregas(
        await entregasApi.listarTodas(
          fechaFiltro ? { fecha: fechaFiltro } : undefined,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar entregas",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const docenteNombre = (e: EntregaListItem) =>
    e.docente_nombre && e.docente_apellido
      ? `${e.docente_nombre} ${e.docente_apellido}`
      : e.docente_username;

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleString("es-BO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const filtered = entregas.filter((e) => {
    const txt = search.toLowerCase();
    return (
      `${e.estudiante_nombre} ${e.estudiante_apellido}`
        .toLowerCase()
        .includes(txt) || docenteNombre(e).toLowerCase().includes(txt)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Registro de Entregas
        </h1>
        <p className="text-muted-foreground">
          Historial de entregas de estudiantes con el docente responsable
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Entregas registradas</CardTitle>
              <CardDescription>{filtered.length} registro(s)</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar estudiante o docente..."
                  className="pl-9 w-full sm:w-64"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Input
                type="date"
                className="w-full sm:w-44"
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value);
                  load(e.target.value || undefined);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Cargando entregas...
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No hay entregas registradas.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha y hora</TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Tutor que recogió</TableHead>
                    <TableHead>Docente responsable</TableHead>
                    <TableHead>Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id_entrega}>
                      <TableCell className="whitespace-nowrap font-mono text-sm">
                        {fmtFecha(e.fecha_hora_entrega)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {iniciales(
                                e.estudiante_nombre,
                                e.estudiante_apellido,
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {e.estudiante_apellido}, {e.estudiante_nombre}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              CI: {e.estudiante_ci ?? "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.nombre_grado
                          ? `${e.nombre_grado} "${e.paralelo}" - ${e.turno}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.tutor_nombre} {e.tutor_apellido}
                        {e.parentesco ? (
                          <span className="text-muted-foreground">
                            {" "}
                            ({e.parentesco})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="font-normal">
                          {docenteNombre(e)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {e.observaciones || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

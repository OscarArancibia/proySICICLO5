"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Megaphone,
  Calendar,
  Users,
  Send,
  School,
  User,
  Globe,
} from "lucide-react";
import {
  avisosApi,
  entregasApi,
  ApiError,
  Aviso,
  AvisoEstudiante,
  DestinatarioTipo,
} from "@/lib/Ciclo4api";
import { cursosApi } from "@/lib/ciclo2Api";

// Roles que pueden publicar (backend: Director=2, Profesor=3)
const ROLES_PUBLICAR = [2, 3];

const tipoConfig: Record<
  DestinatarioTipo,
  { label: string; icon: typeof Globe; color: string }
> = {
  todos: {
    label: "Todos los estudiantes",
    icon: Globe,
    color: "bg-primary/10 text-primary",
  },
  por_curso: {
    label: "Curso específico",
    icon: School,
    color: "bg-info/10 text-info",
  },
  individual: {
    label: "Estudiante específico",
    icon: User,
    color: "bg-success/10 text-success",
  },
};

export default function ComunicacionPage() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<number | null>(null);

  // Formulario "Nuevo aviso"
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [tipo, setTipo] = useState<DestinatarioTipo>("todos");
  const [cursoId, setCursoId] = useState("");
  const [estudianteId, setEstudianteId] = useState("");
  const [publicando, setPublicando] = useState(false);

  // Catálogos para los selectores de destinatario
  const [cursos, setCursos] = useState<{ id_curso: number; label: string }[]>(
    [],
  );
  const [estudiantes, setEstudiantes] = useState<AvisoEstudiante[]>([]);

  const isProfesor = role === 3;
  const canPublish = role !== null && ROLES_PUBLICAR.includes(role);

  // ── Carga inicial ─────────────────────────────────────────────────────────────

  const cargarAvisos = async () => {
    setLoading(true);
    try {
      setAvisos(await avisosApi.listar());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar avisos",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAvisos();
    const stored = localStorage.getItem("userRole");
    const r = stored ? parseInt(stored, 10) : null;
    setRole(r);
    if (r === 3) setTipo("por_curso"); // Profesor no puede usar "todos"
  }, []);

  // Cargar catálogos según el tipo elegido (una sola vez cada uno).
  // El Profesor solo ve sus cursos; el Director ve todos.
  useEffect(() => {
    const cargarCursos = async () => {
      try {
        const list = isProfesor
          ? await entregasApi.listarMisCursos()
          : await cursosApi.getAll();
        setCursos(
          (
            list as Array<{
              id_curso: number;
              nombre_grado: string;
              paralelo: string;
              turno: string;
            }>
          ).map((c) => ({
            id_curso: c.id_curso,
            label: `${c.nombre_grado} "${c.paralelo}" - ${c.turno}`,
          })),
        );
      } catch {
        toast.error("Error al cargar cursos");
      }
    };

    if (tipo === "por_curso" && cursos.length === 0) cargarCursos();
    if (tipo === "individual" && estudiantes.length === 0) {
      avisosApi
        .listarMisEstudiantes()
        .then(setEstudiantes)
        .catch(() => toast.error("Error al cargar estudiantes"));
    }
  }, [tipo, cursos.length, estudiantes.length, isProfesor]);

  // ── Publicar aviso ──────────────────────────────────────────────────────────────

  const resetForm = () => {
    setTitulo("");
    setContenido("");
    setTipo("todos");
    setCursoId("");
    setEstudianteId("");
  };

  const publicar = async () => {
    if (!titulo.trim() || !contenido.trim()) {
      toast.error("Complete el título y el contenido");
      return;
    }
    if (tipo === "por_curso" && !cursoId) {
      toast.error("Seleccione un curso");
      return;
    }
    if (tipo === "individual" && !estudianteId) {
      toast.error("Seleccione un estudiante");
      return;
    }

    setPublicando(true);
    try {
      const res = await avisosApi.publicar({
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        destinatario_tipo: tipo,
        id_curso_destino:
          tipo === "por_curso" ? Number(cursoId) : undefined,
        id_estudiante_destino:
          tipo === "individual" ? Number(estudianteId) : undefined,
      });
      toast.success(res.mensaje || "Aviso publicado correctamente", {
        description: `${res.aviso.destinatarios} destinatario(s) · ${res.aviso.notificaciones_creadas} notificación(es) generada(s)`,
      });
      setOpen(false);
      resetForm();
      cargarAvisos();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Error al publicar el aviso",
      );
    } finally {
      setPublicando(false);
    }
  };

  const contarPorTipo = (t: DestinatarioTipo) =>
    avisos.filter((a) => a.destinatario_tipo === t).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comunicación</h1>
          <p className="text-muted-foreground">
            Avisos y notificaciones para estudiantes y tutores
          </p>
        </div>
        {canPublish && (
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo Aviso
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Avisos</p>
                <p className="text-2xl font-bold">{avisos.length}</p>
              </div>
              <Megaphone className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Generales</p>
                <p className="text-2xl font-bold">{contarPorTipo("todos")}</p>
              </div>
              <Globe className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Por Curso</p>
                <p className="text-2xl font-bold">
                  {contarPorTipo("por_curso")}
                </p>
              </div>
              <School className="h-8 w-8 text-info/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Individuales</p>
                <p className="text-2xl font-bold">
                  {contarPorTipo("individual")}
                </p>
              </div>
              <User className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de avisos */}
      <Card>
        <CardHeader>
          <CardTitle>Avisos Publicados</CardTitle>
          <CardDescription>
            Historial de comunicados registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Cargando avisos...
            </p>
          ) : avisos.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Aún no hay avisos publicados.
            </p>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {avisos.map((aviso) => {
                  const cfg = tipoConfig[aviso.destinatario_tipo];
                  const TipoIcon = cfg.icon;
                  return (
                    <Card key={aviso.id_aviso} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{aviso.titulo}</h3>
                              <Badge
                                variant="secondary"
                                className={`gap-1 ${cfg.color}`}
                              >
                                <TipoIcon className="h-3 w-3" />
                                {cfg.label}
                              </Badge>
                            </div>
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                              {aviso.contenido}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(aviso.fecha_envio).toLocaleString(
                                  "es-BO",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {aviso.publicado_por}
                              </span>
                            </div>
                          </div>
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {aviso.publicado_por.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Diálogo Nuevo Aviso */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Nuevo Aviso</DialogTitle>
            <DialogDescription>
              Complete el comunicado y elija a quién va dirigido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                placeholder="Ej: Reunión de padres"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contenido">Contenido</Label>
              <Textarea
                id="contenido"
                placeholder="Escriba el contenido del aviso..."
                rows={4}
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de destinatario</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as DestinatarioTipo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!isProfesor && (
                    <SelectItem value="todos">Todos los estudiantes</SelectItem>
                  )}
                  <SelectItem value="por_curso">Curso específico</SelectItem>
                  <SelectItem value="individual">
                    Estudiante específico
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipo === "por_curso" && (
              <div className="space-y-2">
                <Label>Curso</Label>
                <Select value={cursoId} onValueChange={setCursoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {cursos.map((c) => (
                      <SelectItem key={c.id_curso} value={String(c.id_curso)}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipo === "individual" && (
              <div className="space-y-2">
                <Label>Estudiante</Label>
                <Select value={estudianteId} onValueChange={setEstudianteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estudiante" />
                  </SelectTrigger>
                  <SelectContent>
                    {estudiantes.map((e) => (
                      <SelectItem
                        key={e.id_estudiante}
                        value={String(e.id_estudiante)}
                      >
                        {e.apellido}, {e.nombre}
                        {e.ci ? ` · CI ${e.ci}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button className="gap-2" onClick={publicar} disabled={publicando}>
              <Send className="h-4 w-4" />
              {publicando ? "Publicando..." : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

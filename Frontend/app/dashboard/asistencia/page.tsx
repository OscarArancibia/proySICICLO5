"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, Users } from "lucide-react";

type Estado =
  | "presente"
  | "ausente"
  | "tardanza"
  | "justificado"
  | "licencia"
  | "";

interface Curso {
  id_curso: number;
  nombre_grado: string;
  nombre_nivel: string;
  paralelo: string;
  turno: string;
  anio: number;
  total_estudiantes: number;
}

interface EstudianteAsistencia {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  ci?: string;
  estado?: string | null;
  estado_texto?: Estado | null;
  observaciones?: string | null;
}

const estadoToDb: Record<Estado, string> = {
  presente: "P",
  ausente: "A",
  tardanza: "T",
  justificado: "J",
  licencia: "L",
  "": "",
};

const estadoFromDb: Record<string, Estado> = {
  P: "presente",
  A: "ausente",
  T: "tardanza",
  J: "justificado",
  L: "licencia",
};

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

export default function AsistenciaPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [idCurso, setIdCurso] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [estudiantes, setEstudiantes] = useState<EstudianteAsistencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCursos = async () => {
      try {
        const res = await fetch(`${API_URL}/api/asistencias/cursos`, {
          headers: getHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Error al cargar cursos");
        setCursos(data);
        if (data[0]?.id_curso) setIdCurso(String(data[0].id_curso));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Error al cargar cursos",
        );
      }
    };
    loadCursos();
  }, []);

  useEffect(() => {
    if (!idCurso) return;
    const loadAsistencia = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/api/asistencias/curso/${idCurso}?fecha=${fecha}`,
          { headers: getHeaders() },
        );
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Error al cargar asistencia");
        setEstudiantes(
          data.estudiantes.map((e: EstudianteAsistencia) => ({
            ...e,
            estado_texto: e.estado ? estadoFromDb[e.estado] : "",
          })),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Error al cargar asistencia",
        );
      } finally {
        setLoading(false);
      }
    };
    loadAsistencia();
  }, [idCurso, fecha]);

  const stats = useMemo(() => {
    return estudiantes.reduce(
      (acc, e) => {
        const key = e.estado_texto || "pendiente";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [estudiantes]);

  const updateStudent = (id: number, patch: Partial<EstudianteAsistencia>) => {
    setEstudiantes((prev) =>
      prev.map((e) => (e.id_estudiante === id ? { ...e, ...patch } : e)),
    );
  };

  const markAllPresent = () => {
    setEstudiantes((prev) =>
      prev.map((e) => ({ ...e, estado_texto: "presente", observaciones: "" })),
    );
  };

  const save = async () => {
    const pendientes = estudiantes.filter((e) => !e.estado_texto);
    if (pendientes.length > 0) {
      toast.error(
        "Todos los estudiantes deben tener un estado antes de guardar",
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/asistencias/curso/${idCurso}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          fecha,
          asistencias: estudiantes.map((e) => ({
            id_estudiante: e.id_estudiante,
            estado: estadoToDb[e.estado_texto || ""],
            observaciones: e.observaciones || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || "Error al guardar asistencia");
      toast.success("Asistencia guardada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar asistencia",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Control de Asistencia
          </h1>
          <p className="text-muted-foreground">
            Registro diario por curso y gestión activa
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllPresent}>
            Marcar presentes
          </Button>
          <Button
            onClick={save}
            disabled={saving || !idCurso}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_180px]">
          <Select value={idCurso} onValueChange={setIdCurso}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar curso" />
            </SelectTrigger>
            <SelectContent>
              {cursos.map((curso) => (
                <SelectItem key={curso.id_curso} value={String(curso.id_curso)}>
                  {curso.nombre_nivel} - {curso.nombre_grado} {curso.paralelo} ·{" "}
                  {curso.turno}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-5">
        {[
          ["Total", estudiantes.length],
          ["Presentes", stats.presente || 0],
          ["Ausentes", stats.ausente || 0],
          ["Tardanzas", stats.tardanza || 0],
          ["Pendientes", stats.pendiente || 0],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
              <Users className="h-7 w-7 text-primary/40" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estudiantes</CardTitle>
          <CardDescription>
            {loading
              ? "Cargando..."
              : `${estudiantes.length} estudiantes inscritos`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>CI</TableHead>
                  <TableHead className="w-[190px]">Estado</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estudiantes.map((estudiante) => (
                  <TableRow key={estudiante.id_estudiante}>
                    <TableCell className="font-medium">
                      {estudiante.apellido} {estudiante.nombre}
                    </TableCell>
                    <TableCell>{estudiante.ci || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={estudiante.estado_texto || ""}
                        onValueChange={(value: Estado) =>
                          updateStudent(estudiante.id_estudiante, {
                            estado_texto: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pendiente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="presente">Presente</SelectItem>
                          <SelectItem value="ausente">Ausente</SelectItem>
                          <SelectItem value="tardanza">Tardanza</SelectItem>
                          <SelectItem value="justificado">
                            Justificado
                          </SelectItem>
                          <SelectItem value="licencia">Licencia</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={estudiante.observaciones || ""}
                        onChange={(e) =>
                          updateStudent(estudiante.id_estudiante, {
                            observaciones: e.target.value,
                          })
                        }
                        placeholder="Opcional"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && estudiantes.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No hay estudiantes inscritos en este curso.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {stats.pendiente ? (
            <Badge variant="outline" className="mt-4">
              Hay estudiantes pendientes de marcar
            </Badge>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

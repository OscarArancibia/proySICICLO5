"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  justificacionesApi,
  estudiantesApi,
  Estudiante,
  Justificacion,
  JustificacionDetalle,
} from "@/lib/ciclo2Api";

export default function JustificacionesPage() {
  const [pendientes, setPendientes] = useState<Justificacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [tab, setTab] = useState<"pendientes" | "registro">("pendientes");
  const [searchForm, setSearchForm] = useState({
    id_estudiante: "",
    fecha: "",
  });
  const [inasistencia, setInasistencia] = useState<JustificacionDetalle | null>(
    null,
  );
  const [justificacionForm, setJustificacionForm] = useState({
    motivo: "",
    observaciones: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPendientes = async () => {
    setLoading(true);
    try {
      const response = await justificacionesApi.listarPendientes();
      setPendientes(response);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cargar justificaciones",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadEstudiantes = async () => {
    try {
      const data = await estudiantesApi.getAll();
      setEstudiantes(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar estudiantes",
      );
    }
  };

  useEffect(() => {
    loadPendientes();
    loadEstudiantes();
  }, []);

  const buscarInasistencia = async () => {
    if (!searchForm.id_estudiante || !searchForm.fecha) {
      toast.error("Seleccione estudiante y fecha");
      return;
    }

    setLoading(true);
    try {
      const persona = await justificacionesApi.buscarInasistencia(
        Number(searchForm.id_estudiante),
        searchForm.fecha,
      );
      setInasistencia(persona);
      toast.success("Inasistencia encontrada");
    } catch (error) {
      setInasistencia(null);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se encontró la inasistencia",
      );
    } finally {
      setLoading(false);
    }
  };

  const registrarJustificacion = async () => {
    if (!inasistencia) {
      toast.error("Primero busque una inasistencia");
      return;
    }
    if (!justificacionForm.motivo.trim()) {
      toast.error("Ingrese el motivo de la justificación");
      return;
    }

    setSaving(true);
    try {
      await justificacionesApi.registrar({
        id_asistencia: inasistencia.id_asistencia,
        motivo: justificacionForm.motivo.trim(),
        observaciones: justificacionForm.observaciones.trim() || undefined,
      });
      toast.success("Justificación registrada");
      setJustificacionForm({ motivo: "", observaciones: "" });
      setInasistencia(null);
      loadPendientes();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al registrar justificación",
      );
    } finally {
      setSaving(false);
    }
  };

  const resolverJustificacion = async (
    id: number,
    estado: "aprobada" | "rechazada",
  ) => {
    setSaving(true);
    try {
      await justificacionesApi.resolver(id, { estado });
      toast.success(`Justificación ${estado}`);
      loadPendientes();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al resolver la justificación",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Justificaciones</h1>
          <p className="text-muted-foreground">
            Administra justificaciones de inasistencias y revisa los casos
            pendientes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === "pendientes" ? "default" : "outline"}
            onClick={() => setTab("pendientes")}
          >
            Pendientes
          </Button>
          <Button
            variant={tab === "registro" ? "default" : "outline"}
            onClick={() => setTab("registro")}
          >
            Nueva justificación
          </Button>
        </div>
      </div>

      {tab === "pendientes" ? (
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes pendientes</CardTitle>
            <CardDescription>
              Revisa y aprueba o rechaza las justificaciones pendientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendientes.map((item) => (
                    <TableRow key={item.id_justificacion}>
                      <TableCell>{item.estudiante}</TableCell>
                      <TableCell>{item.fecha}</TableCell>
                      <TableCell>{item.motivo}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.estado === "pendiente"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {item.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            resolverJustificacion(
                              item.id_justificacion,
                              "aprobada",
                            )
                          }
                          disabled={saving}
                        >
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            resolverJustificacion(
                              item.id_justificacion,
                              "rechazada",
                            )
                          }
                          disabled={saving}
                        >
                          Rechazar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendientes.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No hay justificaciones pendientes.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Registrar nueva justificación</CardTitle>
            <CardDescription>
              Busca la inasistencia y genera la solicitud de justificación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Estudiante</Label>
                <Select
                  value={searchForm.id_estudiante}
                  onValueChange={(value) => {
                    setSearchForm((prev) => ({
                      ...prev,
                      id_estudiante: value,
                    }));
                    setInasistencia(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estudiante" />
                  </SelectTrigger>
                  <SelectContent>
                    {estudiantes.map((estudiante) => (
                      <SelectItem
                        key={estudiante.id_estudiante}
                        value={String(estudiante.id_estudiante)}
                      >
                        {estudiante.apellido} {estudiante.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={searchForm.fecha}
                  onChange={(event) => {
                    setSearchForm((prev) => ({
                      ...prev,
                      fecha: event.target.value,
                    }));
                    setInasistencia(null);
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={buscarInasistencia}
                  disabled={loading}
                  className="w-full"
                >
                  Buscar inasistencia
                </Button>
              </div>
            </div>

            {inasistencia ? (
              <Card className="border border-muted p-4">
                <div className="grid gap-3">
                  <div className="grid gap-1">
                    <p className="text-sm text-muted-foreground">
                      Inasistencia encontrada
                    </p>
                    <p className="font-medium">{searchForm.fecha}</p>
                    <p className="text-sm">Estado: {inasistencia.estado}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Motivo</Label>
                      <Textarea
                        value={justificacionForm.motivo}
                        onChange={(event) =>
                          setJustificacionForm((prev) => ({
                            ...prev,
                            motivo: event.target.value,
                          }))
                        }
                        placeholder="Describa la razón de la justificación"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Observaciones</Label>
                      <Textarea
                        value={justificacionForm.observaciones}
                        onChange={(event) =>
                          setJustificacionForm((prev) => ({
                            ...prev,
                            observaciones: event.target.value,
                          }))
                        }
                        placeholder="Información adicional (opcional)"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={registrarJustificacion} disabled={saving}>
                      Registrar justificación
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="rounded-md border border-dashed border-muted p-4 text-sm text-muted-foreground">
                Busca una inasistencia para continuar con el registro de la
                justificación.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dimensionesApi, Dimension } from "@/lib/ciclo2Api";

export default function DimensionesPage() {
  const [dimensiones, setDimensiones] = useState<Dimension[]>([]);
  const [gestion, setGestion] = useState<{
    id_gestion: number;
    anio: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [newDimension, setNewDimension] = useState({
    nombre_dimension: "",
    puntaje_maximo: "",
  });
  const [editedScores, setEditedScores] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const loadDimensiones = async () => {
    setLoading(true);
    try {
      const response = await dimensionesApi.get();
      setGestion(response.gestion);
      setDimensiones(response.dimensiones);
      setEditedScores(
        Object.fromEntries(
          response.dimensiones.map((dimension) => [
            dimension.id_dimension_eval,
            String(dimension.puntaje_maximo),
          ]),
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar dimensiones",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDimensiones();
  }, []);

  const totalDimensiones = useMemo(() => dimensiones.length, [dimensiones]);

  const handleScoreChange = (id: number, value: string) => {
    setEditedScores((prev) => ({ ...prev, [id]: value }));
  };

  const handleUpdateDimension = async (dimension: Dimension) => {
    const value = editedScores[dimension.id_dimension_eval];
    if (!value) {
      toast.error("Ingrese un puntaje válido");
      return;
    }

    const puntaje = Number(value);
    if (Number.isNaN(puntaje) || puntaje <= 0) {
      toast.error("El puntaje debe ser un número mayor que 0");
      return;
    }

    setSaving(true);
    try {
      await dimensionesApi.update(dimension.id_dimension_eval, {
        puntaje_maximo: puntaje,
      });
      toast.success("Dimensión actualizada");
      loadDimensiones();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al actualizar dimensión",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNewDimension = async () => {
    if (!newDimension.nombre_dimension.trim()) {
      toast.error("Ingrese el nombre de la dimensión");
      return;
    }

    const puntaje = Number(newDimension.puntaje_maximo);
    if (Number.isNaN(puntaje) || puntaje <= 0) {
      toast.error("Ingrese un puntaje válido");
      return;
    }

    setSaving(true);
    try {
      await dimensionesApi.save({
        dimensiones: [
          {
            nombre_dimension: newDimension.nombre_dimension.trim(),
            puntaje_maximo: puntaje,
          },
        ],
      });
      toast.success("Dimensión creada");
      setNewDimension({ nombre_dimension: "", puntaje_maximo: "" });
      loadDimensiones();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar dimensión",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dimensiones de evaluación
          </h1>
          <p className="text-muted-foreground">
            Define y ajusta los puntajes máximos de las dimensiones de la
            gestión activa.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Gestión</p>
              <p className="text-2xl font-bold">
                {gestion ? `Año ${gestion.anio}` : "Cargando..."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Dimensiones</p>
              <p className="text-2xl font-bold">
                {loading ? "..." : totalDimensiones}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de dimensiones</CardTitle>
          <CardDescription>
            Actualiza los puntajes máximos o agrega nuevas dimensiones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Puntaje máximo</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dimensiones.map((dimension) => (
                  <TableRow key={dimension.id_dimension_eval}>
                    <TableCell>{dimension.nombre_dimension}</TableCell>
                    <TableCell>
                      <Input
                        value={
                          editedScores[dimension.id_dimension_eval] ??
                          String(dimension.puntaje_maximo)
                        }
                        type="number"
                        min={1}
                        onChange={(event) =>
                          handleScoreChange(
                            dimension.id_dimension_eval,
                            event.target.value,
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateDimension(dimension)}
                        disabled={saving}
                      >
                        Guardar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {dimensiones.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No hay dimensiones configuradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Nombre de la dimensión</Label>
              <Input
                value={newDimension.nombre_dimension}
                onChange={(event) =>
                  setNewDimension((prev) => ({
                    ...prev,
                    nombre_dimension: event.target.value,
                  }))
                }
                placeholder="Ser, Saber, Hacer..."
              />
            </div>
            <div className="grid gap-2">
              <Label>Puntaje máximo</Label>
              <Input
                value={newDimension.puntaje_maximo}
                type="number"
                min={1}
                onChange={(event) =>
                  setNewDimension((prev) => ({
                    ...prev,
                    puntaje_maximo: event.target.value,
                  }))
                }
                placeholder="100"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSaveNewDimension}
                disabled={saving}
                className="w-full"
              >
                Agregar dimensión
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

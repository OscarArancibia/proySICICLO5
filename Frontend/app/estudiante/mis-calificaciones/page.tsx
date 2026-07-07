"use client";

import { useEffect, useState } from "react";
import {
  estudianteMeApi,
  type GestionCalificacion,
  type MateriaCalificacion,
} from "@/lib/apiEstudiante";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";

export default function MisCalificacionesPage() {
  const [gestiones, setGestiones] = useState<GestionCalificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMateria, setOpenMateria] = useState<Record<string, boolean>>({});

  useEffect(() => {
    estudianteMeApi
      .getMisCalificaciones()
      .then(setGestiones)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleMateria = (key: string) =>
    setOpenMateria((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Mis Calificaciones</h1>
      </div>

      {gestiones.length === 0 && (
        <p className="text-muted-foreground text-sm">No hay calificaciones registradas.</p>
      )}

      {gestiones.map((g) => (
        <div key={g.anio} className="space-y-3">
          <h2 className="font-semibold text-base border-b pb-1">Gestión {g.anio}</h2>

          {g.materias.map((mat) => {
            const key = `${g.anio}-${mat.id_materia}`;
            const open = openMateria[key] ?? false;

            return (
              <Card key={mat.id_materia} className="overflow-hidden">
                <button
                  className="w-full text-left"
                  onClick={() => toggleMateria(key)}
                >
                  <CardHeader className="py-3 hover:bg-muted/30 transition-colors">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {open ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        {mat.nombre_materia}
                      </span>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {mat.campo}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                </button>

                {open && (
                  <CardContent className="pt-0 pb-4 space-y-4">
                    {mat.trimestres.map((trim) => (
                      <div key={trim.trimestre}>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          Trimestre {trim.trimestre}
                        </p>
                        {trim.dimensiones.map((dim) => (
                          <div key={dim.dimension} className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-medium">{dim.dimension}</p>
                              <span className="text-xs text-muted-foreground">
                                {dim.total_obtenido} / {dim.puntaje_maximo} pts
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{
                                  width: `${Math.min(
                                    (dim.total_obtenido / dim.puntaje_maximo) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="mt-2 space-y-1">
                              {dim.actividades.map((act) => (
                                <div
                                  key={act.id_actividad}
                                  className="flex justify-between text-xs text-muted-foreground"
                                >
                                  <span>{act.nombre_actividad}</span>
                                  <span className="font-medium text-foreground">
                                    {act.nota} pts
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-52" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

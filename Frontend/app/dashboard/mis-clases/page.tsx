"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, School } from "lucide-react";
import { licenciasApi, MiClase } from "@/lib/licenciasApi";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const hhmm = (t: string) => (t ? t.slice(0, 5) : "");

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export default function MisClasesPage() {
  const [clases, setClases] = useState<MiClase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    licenciasApi
      .misClases()
      .then(setClases)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Error al cargar"),
      )
      .finally(() => setLoading(false));
  }, []);

  const porDia = DIAS.map((d) => ({
    dia: d,
    bloques: clases.filter((c) => c.dia_semana === d),
  })).filter((g) => g.bloques.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarDays className="h-6 w-6 text-primary" />
          Mis Cursos y Horarios
        </h1>
        <p className="text-muted-foreground">
          Cursos, materias y bloques en los que dictas clase.
        </p>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Cargando...
        </p>
      ) : clases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No tienes clases asignadas en el horario.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {porDia.map((g) => (
            <Card key={g.dia}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{cap(g.dia)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {g.bloques.map((b, i) => (
                  <div
                    key={`${b.hora_inicio}-${b.nombre_materia}-${i}`}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{b.nombre_materia}</p>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {hhmm(b.hora_inicio)}–{hhmm(b.hora_fin)}
                      </Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <School className="h-3 w-3" />
                      {b.nombre_grado} &quot;{b.paralelo}&quot; · {cap(b.turno)}
                    </p>
                    {b.actividad && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {b.actividad}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

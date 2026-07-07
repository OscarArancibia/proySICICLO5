"use client";

import { useEffect, useState } from "react";
import { estudianteMeApi, type MisDatos } from "@/lib/apiEstudiante";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User } from "lucide-react";

const ESTADO_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  activo: "default",
  inactivo: "secondary",
  retirado: "destructive",
  egresado: "secondary",
};

export default function MisDatosPage() {
  const [datos, setDatos] = useState<MisDatos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    estudianteMeApi
      .getMisDatos()
      .then(setDatos)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!datos) return null;

  const campo = (label: string, value: string | null | undefined) => (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Mis Datos</h1>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            {datos.nombre} {datos.apellido}
            <Badge variant={ESTADO_VARIANT[datos.estado] ?? "secondary"}>
              {datos.estado}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {campo("Cédula de Identidad", datos.ci)}
            {campo("Género", datos.genero)}
            {campo(
              "Fecha de Nacimiento",
              datos.fecha_nacimiento
                ? new Date(datos.fecha_nacimiento).toLocaleDateString("es-BO")
                : null
            )}
            {campo(
              "Fecha de Registro",
              new Date(datos.fecha_registro).toLocaleDateString("es-BO")
            )}
          </div>
          {datos.observaciones && (
            <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              {datos.observaciones}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <Card>
        <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

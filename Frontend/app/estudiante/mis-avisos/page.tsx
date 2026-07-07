"use client";

import { useEffect, useState } from "react";
import { Megaphone, Calendar, User } from "lucide-react";
import { avisosApi, type AvisoPanel } from "@/lib/Ciclo4api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MisAvisosPage() {
  const [avisos, setAvisos] = useState<AvisoPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    avisosApi
      .misAvisosPanel()
      .then(setAvisos)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Error al cargar avisos"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Megaphone className="h-6 w-6 text-primary" />
          Mis Avisos
        </h1>
        <p className="text-muted-foreground">Comunicados dirigidos a ti</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : avisos.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No tienes avisos por el momento.
        </p>
      ) : (
        <div className="space-y-4">
          {avisos.map((a) => (
            <Card key={a.id_aviso}>
              <CardContent className="space-y-2 p-4">
                <h3 className="font-semibold">{a.titulo}</h3>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {a.contenido}
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(a.fecha_envio).toLocaleString("es-BO", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {a.publicado_por}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

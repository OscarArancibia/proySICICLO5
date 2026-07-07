"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  UserPlus,
  DollarSign,
  ClipboardList,
  Package,
  Megaphone,
  FileText,
} from "lucide-react"

const actions = [
  {
    title: "Nuevo Estudiante",
    description: "Registrar expediente",
    icon: UserPlus,
    href: "/dashboard/estudiantes/nuevo",
    color: "text-primary",
    bg: "bg-primary/10 hover:bg-primary/20",
  },
  {
    title: "Registrar Pago",
    description: "Nuevo pago o abono",
    icon: DollarSign,
    href: "/dashboard/pagos/nuevo",
    color: "text-success",
    bg: "bg-success/10 hover:bg-success/20",
  },
  {
    title: "Ingresar Notas",
    description: "Calificaciones",
    icon: ClipboardList,
    href: "/dashboard/notas",
    color: "text-warning-foreground",
    bg: "bg-warning/10 hover:bg-warning/20",
  },
  {
    title: "Movimiento Inventario",
    description: "Entrada o salida",
    icon: Package,
    href: "/dashboard/inventario/movimientos",
    color: "text-info",
    bg: "bg-info/10 hover:bg-info/20",
  },
  {
    title: "Nuevo Aviso",
    description: "Comunicar a padres",
    icon: Megaphone,
    href: "/dashboard/comunicacion/nuevo",
    color: "text-accent-foreground",
    bg: "bg-accent hover:bg-accent/80",
  },
  {
    title: "Generar Reporte",
    description: "Exportar datos",
    icon: FileText,
    href: "/dashboard/reportes",
    color: "text-muted-foreground",
    bg: "bg-muted hover:bg-muted/80",
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Acciones Rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {actions.map((action) => {
            const ActionIcon = action.icon
            return (
            <Link key={action.href} href={action.href}>
              <Button
                variant="ghost"
                className={`h-auto w-full flex-col gap-2 p-4 ${action.bg} transition-all duration-200`}
              >
                <ActionIcon className={`h-6 w-6 ${action.color}`} />
                <div className="text-center">
                  <p className="text-xs font-medium">{action.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </Button>
            </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

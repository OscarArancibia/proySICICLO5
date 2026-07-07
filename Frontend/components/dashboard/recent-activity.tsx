"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  UserPlus,
  DollarSign,
  Package,
  Bell,
  ClipboardList,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Activity {
  id: number
  type: "student" | "payment" | "inventory" | "notification" | "grade" | "delivery"
  title: string
  description: string
  time: string
  user: string
  userInitials: string
}

const activities: Activity[] = [
  {
    id: 1,
    type: "payment",
    title: "Pago registrado",
    description: "María García - Mensualidad Abril",
    time: "Hace 5 min",
    user: "Admin",
    userInitials: "AD",
  },
  {
    id: 2,
    type: "student",
    title: "Nuevo estudiante inscrito",
    description: "Juan Pérez López - 3ro Primaria A",
    time: "Hace 30 min",
    user: "Secretaria",
    userInitials: "SE",
  },
  {
    id: 3,
    type: "grade",
    title: "Notas ingresadas",
    description: "2do Kinder B - Primer Trimestre",
    time: "Hace 1 hora",
    user: "Prof. Rodríguez",
    userInitials: "PR",
  },
  {
    id: 4,
    type: "inventory",
    title: "Movimiento de inventario",
    description: "Entrada: 50 cuadernos",
    time: "Hace 2 horas",
    user: "Almacén",
    userInitials: "AL",
  },
  {
    id: 5,
    type: "delivery",
    title: "Entrega registrada",
    description: "Ana Martínez - Recogido por madre",
    time: "Hace 3 horas",
    user: "Prof. López",
    userInitials: "PL",
  },
  {
    id: 6,
    type: "notification",
    title: "Aviso enviado",
    description: "Reunión de padres - 15 de Abril",
    time: "Hace 4 horas",
    user: "Dirección",
    userInitials: "DI",
  },
]

const typeConfig = {
  student: {
    icon: UserPlus,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  payment: {
    icon: DollarSign,
    color: "text-success",
    bg: "bg-success/10",
  },
  inventory: {
    icon: Package,
    color: "text-info",
    bg: "bg-info/10",
  },
  notification: {
    icon: Bell,
    color: "text-warning-foreground",
    bg: "bg-warning/10",
  },
  grade: {
    icon: ClipboardList,
    color: "text-accent-foreground",
    bg: "bg-accent",
  },
  delivery: {
    icon: UserCheck,
    color: "text-secondary-foreground",
    bg: "bg-secondary",
  },
}

export function RecentActivity() {
  const [expanded, setExpanded] = useState(false)
  const visibleActivities = expanded ? activities : activities.slice(0, 3)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Actividad Reciente
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {activities.length} hoy
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="divide-y">
          {visibleActivities.map((activity) => {
            const config = typeConfig[activity.type]
            const Icon = config.icon
            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    config.bg
                  )}
                >
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {activity.time}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.description}
                  </p>
                  <div className="flex items-center gap-1">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px] bg-muted">
                        {activity.userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] text-muted-foreground">
                      {activity.user}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {activities.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 h-8 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Mostrar menos
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Ver {activities.length - 3} más
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

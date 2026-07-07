"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface Student {
  id: number
  name: string
  grade: string
  time: string
  status: "pending" | "ready" | "alert"
  tutor: string
}

const students: Student[] = [
  {
    id: 1,
    name: "María García",
    grade: "Kinder A",
    time: "12:00",
    status: "ready",
    tutor: "Ana García (Madre)",
  },
  {
    id: 2,
    name: "Carlos López",
    grade: "Pre-Kinder B",
    time: "12:00",
    status: "pending",
    tutor: "Pedro López (Padre)",
  },
  {
    id: 3,
    name: "Sofia Rodríguez",
    grade: "Kinder B",
    time: "12:30",
    status: "pending",
    tutor: "María Rodríguez (Madre)",
  },
  {
    id: 4,
    name: "Diego Martínez",
    grade: "Pre-Kinder A",
    time: "12:30",
    status: "alert",
    tutor: "Sin tutor asignado",
  },
]

const statusConfig = {
  pending: {
    icon: Clock,
    label: "Pendiente",
    color: "text-warning-foreground",
    bg: "bg-warning/10",
  },
  ready: {
    icon: CheckCircle2,
    label: "Listo",
    color: "text-success",
    bg: "bg-success/10",
  },
  alert: {
    icon: AlertCircle,
    label: "Alerta",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
}

export function UpcomingDeliveries() {
  const [expanded, setExpanded] = useState(false)
  const visibleStudents = expanded ? students : students.slice(0, 3)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Entregas Próximas
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Kinder / Pre-Kinder
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="space-y-2">
          {visibleStudents.map((student) => {
            const config = statusConfig[student.status]
            const Icon = config.icon
            return (
              <div
                key={student.id}
                className="flex items-center justify-between rounded-lg border p-2.5 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      {student.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{student.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {student.grade} · {student.time}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{student.tutor}</p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={cn("gap-1 shrink-0 text-[10px] px-1.5 py-0.5", config.bg, config.color)}
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 mt-3">
          {students.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  +{students.length - 3} más
                </>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
            Ver todas
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

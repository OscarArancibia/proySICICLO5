"use client"

import {
  StatCard,
  QuickActions,
  RecentActivity,
  PaymentChart,
  StudentsByLevel,
  UpcomingDeliveries,
} from "@/components/dashboard"
import {
  Bell,
  UserCheck,
  TrendingUp,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Dashboard Principal */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Bienvenido, Administrador
        </h1>
        <p className="text-muted-foreground">
          Este es el panel principal del sistema. Aquí encontrará un resumen de
          la actividad de la Unidad Educativa.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Estudiantes"
          value="287"
          description="Total inscritos"
          iconName="users"
          href="/dashboard/estudiantes"
          variant="primary"
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title="Docentes"
          value="18"
          description="Personal activo"
          iconName="graduation-cap"
          href="/dashboard/usuarios/docentes"
          variant="secondary"
        />
        <StatCard
          title="Pagos del Mes"
          value="Bs. 45,200"
          description="Abril 2025"
          iconName="dollar-sign"
          href="/dashboard/pagos"
          variant="success"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Inventario"
          value="156"
          description="Items registrados"
          iconName="package"
          href="/dashboard/inventario"
          variant="warning"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Secondary Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tutores</p>
                    <p className="text-2xl font-bold">215</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-success">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Pagos al día
                    </p>
                    <p className="text-2xl font-bold">89%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-success/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-destructive">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Pagos Pendientes
                    </p>
                    <p className="text-2xl font-bold">32</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-destructive/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <PaymentChart />
            <StudentsByLevel />
          </div>

          {/* Avisos Recientes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Avisos Recientes
                </CardTitle>
                <Badge variant="secondary">3 activos</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    title: "Reunión de Padres",
                    date: "15 de Abril, 2025",
                    level: "Todos los niveles",
                  },
                  {
                    title: "Feriado - Día del Trabajador",
                    date: "1 de Mayo, 2025",
                    level: "Todos los niveles",
                  },
                  {
                    title: "Festival de Primavera",
                    date: "21 de Septiembre, 2025",
                    level: "Kinder y Pre-Kinder",
                  },
                ].map((notice, idx) => (
                  <Card key={idx} className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="font-medium text-sm">{notice.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notice.date}
                      </p>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {notice.level}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Alert */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">
                  Inventario Bajo
                </CardTitle>
                <Badge variant="destructive">Requiere atención</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Cuadernos rayados", current: 12, max: 100 },
                  { name: "Lápices HB", current: 25, max: 200 },
                  { name: "Uniformes talla M", current: 3, max: 30 },
                ].map((item) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.current} / {item.max}
                      </span>
                    </div>
                    <Progress
                      value={(item.current / item.max) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-6">
          <UpcomingDeliveries />
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}

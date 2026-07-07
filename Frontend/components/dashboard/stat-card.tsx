"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Users,
  GraduationCap,
  DollarSign,
  Package,
  Bell,
  UserCheck,
  TrendingUp,
  AlertCircle,
  BookOpen,
  MessageSquare,
  Shield,
  FileText,
  type LucideIcon,
} from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  users: Users,
  "graduation-cap": GraduationCap,
  "dollar-sign": DollarSign,
  package: Package,
  bell: Bell,
  "user-check": UserCheck,
  "trending-up": TrendingUp,
  "alert-circle": AlertCircle,
  "book-open": BookOpen,
  "message-square": MessageSquare,
  shield: Shield,
  "file-text": FileText,
}

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  iconName: keyof typeof iconMap
  href: string
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: "default" | "primary" | "secondary" | "accent" | "success" | "warning"
}

const variantStyles = {
  default: "bg-card hover:bg-muted/50",
  primary: "bg-primary/10 hover:bg-primary/15 border-primary/20",
  secondary: "bg-secondary hover:bg-secondary/80 border-secondary",
  accent: "bg-accent hover:bg-accent/80 border-accent",
  success: "bg-success/10 hover:bg-success/15 border-success/20",
  warning: "bg-warning/10 hover:bg-warning/15 border-warning/20",
}

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/20 text-primary",
  secondary: "bg-secondary-foreground/10 text-secondary-foreground",
  accent: "bg-accent-foreground/10 text-accent-foreground",
  success: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning-foreground",
}

export function StatCard({
  title,
  value,
  description,
  iconName,
  href,
  trend,
  variant = "default",
}: StatCardProps) {
  const Icon = iconMap[iconName] || Users

  return (
    <Link href={href}>
      <Card
        className={cn(
          "group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
          variantStyles[variant]
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {title}
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-foreground">{value}</p>
                {trend && (
                  <span
                    className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded",
                      trend.isPositive
                        ? "text-success bg-success/10"
                        : "text-destructive bg-destructive/10"
                    )}
                  >
                    {trend.isPositive ? "+" : ""}{trend.value}%
                  </span>
                )}
              </div>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                iconVariantStyles[variant]
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

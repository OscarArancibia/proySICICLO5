"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Bell,
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutSession } from "@/lib/auth";

interface HeaderProps {
  isCollapsed: boolean;
  isMobile: boolean;
  onMenuClick: () => void;
}

export function Header({ isCollapsed, isMobile, onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifications] = useState([
    { id: 1, title: "Nuevo pago registrado", time: "Hace 5 min", read: false },
    { id: 2, title: "Estudiante inscrito", time: "Hace 1 hora", read: false },
    {
      id: 3,
      title: "Stock bajo en materiales",
      time: "Hace 2 horas",
      read: true,
    },
  ]);

  const [userName, setUserName] = useState("Usuario");

  useEffect(() => {
    setMounted(true);
    const name = localStorage.getItem("userName");
    if (name) setUserName(name);
  }, []);

  const isDark = mounted && theme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header
      className={cn(
        "fixed top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300",
        isMobile ? "left-0" : isCollapsed ? "md:left-[72px]" : "md:left-64",
        "right-0",
      )}
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar estudiantes, pagos, reportes..."
            className="w-60 pl-9 xl:w-80"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground"
          suppressHydrationWarning
        >
          {!mounted ? (
            <Sun className="h-5 w-5 opacity-0" aria-hidden />
          ) : isDark ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
          <span className="sr-only">Cambiar tema</span>
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground p-0 text-[10px] font-bold flex items-center justify-center border-2 border-background">
                  {unreadCount}
                </span>
              )}
              <span className="sr-only">Notificaciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notificaciones
              <Badge variant="secondary">{unreadCount} nuevas</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 cursor-pointer",
                  !notification.read && "bg-muted/50",
                )}
              >
                <div className="flex items-center gap-2">
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                  <span className="font-medium text-sm">
                    {notification.title}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground ml-4">
                  {notification.time}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-primary cursor-pointer">
              Ver todas las notificaciones
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src="/placeholder-user.jpg" alt="Usuario" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  AD
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">
                  Sistema de Gestión
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Mi Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={logoutSession}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

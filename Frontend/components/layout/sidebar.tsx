"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { logoutSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CreditCard,
  Package,
  ClipboardList,
  Bell,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronLeft,
  LogOut,
  UserCog,
  School,
  BookOpen,
  DollarSign,
  Boxes,
  ArrowRightLeft,
  Megaphone,
  BarChart3,
  UserCheck,
  History,
  DoorOpen,
  CalendarCheck,
  CalendarClock,
  Lock,
  MessageSquare,
  Receipt,
} from "lucide-react";

interface NavItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    roles?: number[];
  }[];
  roles?: number[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [1, 2, 3, 4, 5],
  },
  // 1. SEGURIDAD
  {
    title: "Seguridad",
    icon: Lock,
    roles: [1, 2],
    children: [
      {
        title: "Gestión de Usuarios",
        href: "/dashboard/usuarios",
        icon: UserCog,
        roles: [1],
      },
      {
        title: "Roles y Permisos",
        href: "/dashboard/usuarios/roles",
        icon: ShieldCheck,
        roles: [1],
      },
      {
        title: "Bitácora",
        href: "/dashboard/bitacora",
        icon: History,
        roles: [1],
      },
      {
        title: "Personal Docente",
        href: "/dashboard/usuarios/docentes",
        icon: GraduationCap,
        roles: [1, 2],
      },
    ],
  },
  // 2. ESTUDIANTES
  {
    title: "Estudiantes",
    icon: Users,
    roles: [1, 2, 3, 4, 12],
    children: [
      {
        title: "Gestión Académica",
        href: "/dashboard/gestiones",
        icon: CalendarCheck,
        roles: [1, 2],
      },
      {
        title: "Niveles y Aulas",
        href: "/dashboard/aulas",
        icon: DoorOpen,
        roles: [1, 2],
      },
      {
        title: "Campos y Materias",
        href: "/dashboard/materias",
        icon: BookOpen,
        roles: [1, 2],
      },
      {
        title: "Cursos",
        href: "/dashboard/cursos",
        icon: School,
        roles: [1, 2],
      },
      {
        title: "Horarios",
        href: "/dashboard/horarios",
        icon: CalendarCheck,
        roles: [1, 2, 4],
      },
      {
        title: "Estudiantes",
        href: "/dashboard/estudiantes",
        icon: GraduationCap,
        roles: [1, 2, 4],
      },
      {
        title: "Inscripciones",
        href: "/dashboard/inscripciones",
        icon: ClipboardList,
        roles: [1, 2, 4],
      },
      {
        title: "Tutores",
        href: "/dashboard/tutores",
        icon: UserCheck,
        roles: [1, 2, 4],
      },
      {
        title: "Expedientes",
        href: "/dashboard/expedientes",
        icon: FileText,
        roles: [1, 2, 3, 4],
      },
      {
        title: "Asistencia",
        href: "/dashboard/asistencia",
        icon: UserCheck,
        roles: [1, 2, 3],
      },
      {
        title: "Calificaciones",
        href: "/dashboard/calificaciones",
        icon: GraduationCap,
        roles: [1, 2, 3],
      },
      {
        title: "Notas",
        href: "/dashboard/notas",
        icon: FileText,
        roles: [1, 2, 3],
      },
      {
        title: "Libretas",
        href: "/dashboard/libretas",
        icon: FileText,
        roles: [1, 2, 3, 4],
      },
      {
        title: "Monitoreo académico",
        href: "/dashboard/monitoreo",
        icon: BarChart3,
        roles: [1, 2, 3],
      },
      {
        title: "Entregas",
        href: "/dashboard/entregas",
        icon: ArrowRightLeft,
        roles: [1, 2, 3, 4, 12],
      },
    ],
  },
  // 3. Pagos
  {
    title: "Pagos",
    icon: DollarSign,
    roles: [1, 2, 4],
    children: [
      {
        title: "Pagos",
        href: "/dashboard/pagos",
        icon: CreditCard,
        roles: [1, 2, 4],
      },
      {
        title: "Estados de Cuenta",
        href: "/dashboard/estado-cuenta",
        icon: Receipt,
        roles: [1, 2, 4],
      },
      {
        title: "Reportes",
        href: "/dashboard/reportes",
        icon: BarChart3,
        roles: [1, 2, 4],
      },
    ],
  },
  // 4. INVENTARIO
  {
    title: "Inventario",
    icon: Boxes,
    roles: [1, 2, 4],
    children: [
      {
        title: "Inventario",
        href: "/dashboard/inventario",
        icon: Package,
        roles: [1, 2, 4],
      },
    ],
  },
  // 5. COMUNICACIÓN
  {
    title: "Comunicación",
    icon: MessageSquare,
    roles: [1, 2, 3, 4],
    children: [
      {
        title: "Avisos",
        href: "/dashboard/comunicacion",
        icon: Megaphone,
        roles: [1, 2, 3, 4],
      },
      {
        title: "Citas de Atención",
        href: "/dashboard/citas",
        icon: CalendarClock,
        roles: [2, 3],
      },
    ],
  },
  // 6. PERSONAL
  {
    title: "Personal",
    icon: UserCog,
    roles: [2, 3, 4],
    children: [
      {
        title: "Licencias y Permisos",
        href: "/dashboard/licencias",
        icon: CalendarClock,
        roles: [2, 3, 4],
      },
      {
        title: "Mis Cursos y Horarios",
        href: "/dashboard/mis-clases",
        icon: CalendarCheck,
        roles: [3],
      },
    ],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  isMobile: boolean;
  isMobileOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
}

export function Sidebar({
  isCollapsed,
  isMobile,
  isMobileOpen,
  onToggle,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>("Usuario");

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (role) setUserRole(parseInt(role, 10));
    const name = localStorage.getItem("userName");
    if (name) setUserName(name);
  }, []);

  const isActive = (href: string) => pathname === href;
  const isParentActive = (children?: { href: string }[]) =>
    children?.some((child) => pathname.startsWith(child.href));

  useEffect(() => {
    const activeItem = navItems.find((item) =>
      item.children?.some(
        (child) =>
          pathname.startsWith(child.href) &&
          (!child.roles || userRole === null || child.roles.includes(userRole)),
      ),
    );

    if (!activeItem) return;

    setOpenItems((prev) =>
      prev.includes(activeItem.title) ? prev : [...prev, activeItem.title],
    );
  }, [pathname, userRole]);

  const setItemOpen = (title: string, open: boolean) => {
    setOpenItems((prev) =>
      open
        ? prev.includes(title)
          ? prev
          : [...prev, title]
        : prev.filter((item) => item !== title),
    );
  };

  const filteredNavItems = navItems
    .filter((item) => {
      if (!item.roles) return true;
      if (userRole === null) return true;
      return item.roles.includes(userRole);
    })
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter(
            (child) =>
              !child.roles ||
              (userRole !== null && child.roles.includes(userRole)),
          ),
        };
      }
      return item;
    })
    .filter((item) => {
      if (item.children && item.children.length === 0) return false;
      return true;
    });

  const handleNavClick = () => {
    if (isMobile) onCloseMobile();
  };

  return (
    <>
      {isMobile && isMobileOpen && (
        <button
          aria-label="Cerrar menú lateral"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
          isMobile
            ? cn(
                "w-72 max-w-[85vw]",
                isMobileOpen ? "translate-x-0" : "-translate-x-full",
              )
            : isCollapsed
              ? "w-[72px]"
              : "w-64",
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Header */}
          <div
            className={cn(
              "flex h-16 items-center border-b border-sidebar-border px-4",
              isCollapsed ? "justify-center" : "justify-between",
            )}
          >
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
                  <img
                    src="/logoBuho.webp"
                    alt="Logo"
                    className="h-9 w-9 rounded-full"
                  />
                </div>
                <span className="font-semibold text-lg">EduGestión</span>
              </div>
            )}
            {isCollapsed && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
                <img
                  src="/logoBuho.webp"
                  alt="Logo"
                  className="h-9 w-9 rounded-full"
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className={cn(
                "h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent",
                !isMobile &&
                  isCollapsed &&
                  "absolute -right-3 top-6 z-50 rounded-full bg-sidebar-primary text-sidebar-primary-foreground shadow-md hover:bg-sidebar-primary/90",
              )}
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 transition-transform",
                  !isMobile && isCollapsed && "rotate-180",
                )}
              />
            </Button>
          </div>

          {/* User Profile */}
          <div
            className={cn(
              "border-b border-sidebar-border p-4",
              isCollapsed && "flex justify-center py-4",
            )}
          >
            {!isCollapsed ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-sidebar-primary/50">
                  <AvatarImage src="/placeholder-user.jpg" alt="Usuario" />
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                    AD
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{userName}</p>
                  <p className="truncate text-xs text-sidebar-foreground/70">
                    {userRole === 1
                      ? "SuperUsuario"
                      : userRole === 2
                        ? "Director"
                        : "Personal"}
                  </p>
                </div>
              </div>
            ) : (
              <Avatar className="h-9 w-9 ring-2 ring-sidebar-primary/50">
                <AvatarImage src="/placeholder-user.jpg" alt="Usuario" />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  AD
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Navigation */}
          <ScrollArea className="min-h-0 flex-1 px-3 py-4">
            <nav className="space-y-1">
              {filteredNavItems.map((item) => {
                const ItemIcon = item.icon;
                if (item.children && item.children.length > 0) {
                  const isOpen = openItems.includes(item.title);
                  return (
                    <Collapsible
                      key={item.title}
                      open={!isCollapsed && isOpen}
                      onOpenChange={(open) =>
                        !isCollapsed && setItemOpen(item.title, open)
                      }
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            isParentActive(item.children) &&
                              "bg-sidebar-accent text-sidebar-accent-foreground",
                            isCollapsed && "justify-center px-2",
                          )}
                        >
                          <ItemIcon className="h-5 w-5 shrink-0" />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-left text-sm">
                                {item.title}
                              </span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  isOpen && "rotate-180",
                                )}
                              />
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      {!isCollapsed && (
                        <CollapsibleContent className="space-y-1 pt-1">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <Button
                                key={child.href}
                                variant="ghost"
                                asChild
                                className={cn(
                                  "w-full justify-start gap-3 pl-10 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                  isActive(child.href) &&
                                    "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
                                )}
                              >
                                <Link
                                  href={child.href}
                                  onClick={handleNavClick}
                                >
                                  <ChildIcon className="h-4 w-4 shrink-0" />
                                  <span className="text-sm">{child.title}</span>
                                </Link>
                              </Button>
                            );
                          })}
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  );
                }

                return (
                  <Button
                    key={item.title}
                    variant="ghost"
                    asChild
                    className={cn(
                      "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive(item.href!) &&
                        "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
                      isCollapsed && "justify-center px-2",
                    )}
                  >
                    <Link href={item.href!} onClick={handleNavClick}>
                      <ItemIcon className="h-5 w-5 shrink-0" />
                      {!isCollapsed && (
                        <span className="text-sm">{item.title}</span>
                      )}
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div
            className={cn(
              "border-t border-sidebar-border p-3",
              isCollapsed && "flex justify-center",
            )}
          >
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isCollapsed && "justify-center px-2",
              )}
              onClick={logoutSession}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="text-sm">Cerrar Sesión</span>}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

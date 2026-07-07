"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { GraduationCap, User, BookOpen, CreditCard, Megaphone, CalendarClock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";

const NAV = [
  { href: "/estudiante/mis-datos",          label: "Mis Datos",          icon: User },
  { href: "/estudiante/mis-calificaciones", label: "Calificaciones",     icon: BookOpen },
  { href: "/estudiante/mis-pagos",          label: "Pagos",              icon: CreditCard },
  { href: "/estudiante/mis-avisos",         label: "Avisos",             icon: Megaphone },
  { href: "/estudiante/citas",              label: "Reuniones",          icon: CalendarClock },
];

export default function EstudianteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const rol = localStorage.getItem("userNombreRol");
    if (!token || rol !== "Estudiante") {
      router.replace("/login");
      return;
    }
    setUserName(localStorage.getItem("userName") || "Estudiante");
  }, [router]);

  async function handleLogout() {
    const token = localStorage.getItem("token");
    if (token) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.clear();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-primary shrink-0">
            <GraduationCap className="h-5 w-5" />
            <span className="hidden sm:inline">EduGestión</span>
          </div>

          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href}>
                  <Button
                    variant={active ? "default" : "ghost"}
                    size="sm"
                    className="gap-1.5"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground hidden md:inline">{userName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

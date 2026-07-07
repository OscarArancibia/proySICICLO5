"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen((prev) => !prev);
      return;
    }
    setIsCollapsed((prev) => !prev);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isCollapsed={isCollapsed}
        isMobile={isMobile}
        isMobileOpen={isMobileMenuOpen}
        onToggle={toggleSidebar}
        onCloseMobile={closeMobileMenu}
      />
      <Header
        isCollapsed={isCollapsed}
        isMobile={isMobile}
        onMenuClick={toggleSidebar}
      />
      <main
        className={cn(
          "min-h-screen pt-16 transition-all duration-300",
          isMobile ? "pl-0" : isCollapsed ? "md:pl-[72px]" : "md:pl-64",
        )}
      >
        <div className="animate-fade-in p-3 sm:p-4 lg:p-6">{children}</div>
      </main>
      <ChatbotWidget />
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal de Pagos — EduGestión",
  description: "Paga tus deudas de forma segura con Stripe.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}

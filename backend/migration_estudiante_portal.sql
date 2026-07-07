-- =====================================================================
-- Migración: Portal estudiantil + cuentas para estudiantes + Stripe
-- Ejecutar contra la base de datos existente
-- =====================================================================

-- 1. Vincular estudiante a usuario (patrón igual que profesor)
ALTER TABLE public.estudiante
  ADD COLUMN IF NOT EXISTS id_usuario integer
  REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;

-- 2. Permitir pagos de portal (sin admin registrador)
ALTER TABLE public.pago
  ALTER COLUMN id_usuario_registro DROP NOT NULL;

-- 3. Columna para tracking del PaymentIntent de Stripe
ALTER TABLE public.pago
  ADD COLUMN IF NOT EXISTS id_stripe_payment_intent character varying(100);

-- 4. Agregar 'stripe' como método de pago válido
ALTER TABLE public.pago DROP CONSTRAINT IF EXISTS pago_metodo_pago_check;
ALTER TABLE public.pago ADD CONSTRAINT pago_metodo_pago_check
  CHECK ((metodo_pago)::text = ANY (ARRAY[
    'efectivo'::text, 'QR'::text, 'transferencia'::text, 'stripe'::text
  ]));

-- 5. Rol Estudiante
INSERT INTO public.rol (nombre_rol, descripcion, estado)
SELECT 'Estudiante', 'Acceso al portal estudiantil: notas, pagos y datos personales', true
WHERE NOT EXISTS (SELECT 1 FROM public.rol WHERE nombre_rol = 'Estudiante');

-- 6. Permisos del estudiante
INSERT INTO public.permiso (nombre_permiso, descripcion) VALUES
  ('ver_mis_datos',          'Ver sus propios datos personales'),
  ('ver_mis_calificaciones', 'Ver sus propias calificaciones'),
  ('ver_mis_pagos',          'Ver sus propios pagos y deudas'),
  ('realizar_pago',          'Realizar pagos en línea')
ON CONFLICT (nombre_permiso) DO NOTHING;

-- 7. Vincular permisos al rol Estudiante
INSERT INTO public.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM public.rol r
CROSS JOIN public.permiso p
WHERE r.nombre_rol = 'Estudiante'
  AND p.nombre_permiso IN ('ver_mis_datos', 'ver_mis_calificaciones', 'ver_mis_pagos', 'realizar_pago')
  AND NOT EXISTS (
    SELECT 1 FROM public.rol_permiso rp
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
  );

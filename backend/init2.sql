SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE OR REPLACE FUNCTION public.fn_validar_entrega_autorizada()
RETURNS TRIGGER AS $$
DECLARE
    v_autorizado BOOLEAN;
BEGIN
    SELECT autorizado_recoger INTO v_autorizado
    FROM public.tutor_estudiante
    WHERE id_estudiante = NEW.id_estudiante
      AND id_tutor = NEW.id_tutor;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El tutor con ID % no está vinculado al estudiante con ID %', NEW.id_tutor, NEW.id_estudiante;
    END IF;

    IF v_autorizado IS FALSE OR v_autorizado IS NULL THEN
        RAISE EXCEPTION 'El tutor no está autorizado para recoger al estudiante (autorizado_recoger = false)';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION public.fn_actualizar_deuda_al_pagar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.estado = 'validado' THEN
        UPDATE deuda
        SET estado = 'pagado'
        WHERE id_deuda = NEW.id_deuda;
    END IF;
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.fn_actualizar_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.tipo_movimiento = 'entrada' THEN
        UPDATE material
        SET stock_actual = stock_actual + NEW.cantidad
        WHERE id_material = NEW.id_material;
    ELSIF NEW.tipo_movimiento = 'salida' THEN
        IF (SELECT stock_actual FROM material WHERE id_material = NEW.id_material) < NEW.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %',
                (SELECT stock_actual FROM material WHERE id_material = NEW.id_material),
                NEW.cantidad;
        END IF;
        UPDATE material
        SET stock_actual = stock_actual - NEW.cantidad
        WHERE id_material = NEW.id_material;
    END IF;
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.fn_bitacora_asistencia() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO bitacora (
        id_usuario,
        id_modulo,
        id_funcionalidad,
        accion,
        tabla_afectada,
        id_registro_afectado,
        descripcion
    )
    SELECT
        NEW.id_usuario_registro,
        m.id_modulo,
        f.id_funcionalidad,
        CASE WHEN TG_OP = 'INSERT' THEN 'INSERT' ELSE 'UPDATE' END,
        'asistencia',
        NEW.id_asistencia,
        'Se registró o actualizó asistencia estudiantil.'
    FROM modulo m
    LEFT JOIN funcionalidad f ON f.id_modulo = m.id_modulo
    LEFT JOIN permiso p ON p.id_permiso = f.id_permiso
    WHERE m.nombre_modulo = 'asistencias'
      AND p.nombre_permiso = 'registrar_asistencia'
    LIMIT 1;
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.fn_bitacora_entrega() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO bitacora (
        id_usuario,
        id_modulo,
        id_funcionalidad,
        accion,
        tabla_afectada,
        id_registro_afectado,
        descripcion
    )
    SELECT
        NEW.id_usuario_supervisor,
        m.id_modulo,
        f.id_funcionalidad,
        'INSERT',
        'entrega_estudiante',
        NEW.id_entrega,
        'Se registró la entrega de un estudiante.'
    FROM modulo m
    LEFT JOIN funcionalidad f ON f.id_modulo = m.id_modulo
    LEFT JOIN permiso p ON p.id_permiso = f.id_permiso
    WHERE m.nombre_modulo = 'entregas'
      AND p.nombre_permiso = 'registrar_entregas'
    LIMIT 1;
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.fn_bitacora_pago() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO bitacora (
        id_usuario,
        id_modulo,
        id_funcionalidad,
        accion,
        tabla_afectada,
        id_registro_afectado,
        descripcion
    )
    SELECT
        NEW.id_usuario_registro,
        m.id_modulo,
        f.id_funcionalidad,
        CASE WHEN TG_OP = 'INSERT' THEN 'INSERT' ELSE 'UPDATE' END,
        'pago',
        NEW.id_pago,
        'Se registró o actualizó un pago en el sistema.'
    FROM modulo m
    LEFT JOIN funcionalidad f ON f.id_modulo = m.id_modulo
    LEFT JOIN permiso p ON p.id_permiso = f.id_permiso
    WHERE m.nombre_modulo = 'pagos'
      AND p.nombre_permiso = 'gestionar_pagos'
    LIMIT 1;
    RETURN NEW;
END;
$$;


CREATE FUNCTION public.fn_calcular_edad() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.fecha_nacimiento IS NOT NULL THEN
        NEW.edad := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.fecha_nacimiento));
    END IF;
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.fn_marcar_deudas_en_mora() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE deuda
    SET estado = 'mora'
    WHERE estado = 'pendiente'
      AND fecha_generacion < (CURRENT_DATE - INTERVAL '30 days');
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.fn_validar_inscripcion_unica() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_gestion_nueva INT;
    v_existe BOOLEAN;
BEGIN
    SELECT id_gestion
    INTO v_gestion_nueva
    FROM curso
    WHERE id_curso = NEW.id_curso;
    SELECT EXISTS (
        SELECT 1
        FROM inscripcion i
        JOIN curso c ON i.id_curso = c.id_curso
        WHERE i.id_estudiante = NEW.id_estudiante
          AND c.id_gestion = v_gestion_nueva
          AND i.estado = 'inscrito'
          AND i.id_inscripcion IS DISTINCT FROM NEW.id_inscripcion
    )
    INTO v_existe;
    IF v_existe THEN
        RAISE EXCEPTION 'El estudiante ya tiene una inscripción activa en la gestión %',
            v_gestion_nueva;
    END IF;
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.fn_validar_nota_maxima() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_max DECIMAL;
BEGIN
    SELECT de.puntaje_maximo
    INTO v_max
    FROM actividad_evaluacion ae
    JOIN dimension_evaluacion de ON ae.id_dimension_eval = de.id_dimension_eval
    WHERE ae.id_actividad = NEW.id_actividad;
    IF NEW.nota > v_max THEN
        RAISE EXCEPTION 'La nota (%) excede el puntaje máximo permitido (%)',
            NEW.nota, v_max;
    END IF;
    RETURN NEW;
END;
$$;
SET default_tablespace = '';
SET default_table_access_method = heap;
CREATE TABLE public.actividad_evaluacion (
    id_actividad integer NOT NULL,
    id_curso_materia integer NOT NULL,
    id_dimension_eval integer NOT NULL,
    trimestre integer NOT NULL,
    nombre_actividad character varying(100) NOT NULL,
    fecha_actividad date,
    CONSTRAINT actividad_evaluacion_trimestre_check CHECK (((trimestre >= 1) AND (trimestre <= 3)))
);
CREATE SEQUENCE public.actividad_evaluacion_id_actividad_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.actividad_evaluacion_id_actividad_seq OWNED BY public.actividad_evaluacion.id_actividad;
CREATE TABLE public.asistencia (
    id_asistencia integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_curso integer NOT NULL,
    fecha date NOT NULL,
    estado character varying(5) NOT NULL,
    observaciones text,
    id_usuario_registro integer NOT NULL,
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT asistencia_estado_check CHECK (((estado)::text = ANY (ARRAY[('P'::character varying)::text, ('A'::character varying)::text, ('T'::character varying)::text, ('J'::character varying)::text, ('L'::character varying)::text])))
);
CREATE SEQUENCE public.asistencia_id_asistencia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.asistencia_id_asistencia_seq OWNED BY public.asistencia.id_asistencia;
CREATE TABLE public.aula (
    id_aula integer NOT NULL,
    numero_aula character varying(20) NOT NULL,
    descripcion text,
    cantidad_mesas integer DEFAULT 0 NOT NULL,
    cantidad_sillas integer DEFAULT 0 NOT NULL,
    capacidad_estudiantes integer DEFAULT 0 NOT NULL
);
CREATE SEQUENCE public.aula_id_aula_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.aula_id_aula_seq OWNED BY public.aula.id_aula;
CREATE TABLE public.aviso (
    id_aviso integer NOT NULL,
    titulo character varying(200) NOT NULL,
    contenido text NOT NULL,
    id_usuario integer NOT NULL,
    destinatario_tipo character varying(20) NOT NULL,
    id_curso_destino integer,
    fecha_envio timestamp without time zone DEFAULT now() NOT NULL,
    estado character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    CONSTRAINT aviso_destinatario_tipo_check CHECK (((destinatario_tipo)::text = ANY (ARRAY[('todos'::character varying)::text, ('por_curso'::character varying)::text, ('individual'::character varying)::text]))),
    CONSTRAINT aviso_estado_check CHECK (((estado)::text = ANY (ARRAY[('borrador'::character varying)::text, ('enviado'::character varying)::text, ('cancelado'::character varying)::text])))
);
CREATE SEQUENCE public.aviso_id_aviso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.aviso_id_aviso_seq OWNED BY public.aviso.id_aviso;
CREATE TABLE public.bitacora (
    id_bitacora integer NOT NULL,
    id_usuario integer,
    id_modulo integer,
    id_funcionalidad integer,
    accion character varying(50) NOT NULL,
    tabla_afectada character varying(100),
    id_registro_afectado integer,
    descripcion text,
    fecha_hora timestamp without time zone DEFAULT now() NOT NULL,
    ip_origen character varying(45),
    CONSTRAINT bitacora_accion_check CHECK (((accion)::text = ANY (ARRAY[('LOGIN'::character varying)::text, ('LOGOUT'::character varying)::text, ('INSERT'::character varying)::text, ('UPDATE'::character varying)::text, ('DELETE'::character varying)::text, ('APROBACION'::character varying)::text, ('VALIDACION'::character varying)::text, ('EXPORTACION'::character varying)::text, ('CONSULTA'::character varying)::text, ('SISTEMA'::character varying)::text])))
);
CREATE SEQUENCE public.bitacora_id_bitacora_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.bitacora_id_bitacora_seq OWNED BY public.bitacora.id_bitacora;
CREATE TABLE public.calificacion (
    id_calificacion integer NOT NULL,
    id_actividad integer NOT NULL,
    id_estudiante integer NOT NULL,
    nota numeric(5,2) NOT NULL,
    fecha_evaluacion date DEFAULT CURRENT_DATE NOT NULL,
    observaciones text,
    CONSTRAINT calificacion_nota_check CHECK ((nota >= (0)::numeric))
);
CREATE SEQUENCE public.calificacion_id_calificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.calificacion_id_calificacion_seq OWNED BY public.calificacion.id_calificacion;
CREATE TABLE public.campo_saber (
    id_campo integer NOT NULL,
    nombre_campo character varying(100) NOT NULL,
    orden_visualizacion integer NOT NULL,
    descripcion text
);
CREATE SEQUENCE public.campo_saber_id_campo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.campo_saber_id_campo_seq OWNED BY public.campo_saber.id_campo;
CREATE TABLE public.comprobante (
    id_comprobante integer NOT NULL,
    id_pago integer NOT NULL,
    numero_comprobante character varying(50) NOT NULL,
    archivo_pdf_url character varying(255),
    fecha_emision timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.comprobante_id_comprobante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.comprobante_id_comprobante_seq OWNED BY public.comprobante.id_comprobante;
CREATE TABLE public.concepto_pago (
    id_concepto integer NOT NULL,
    nombre_concepto character varying(100) NOT NULL,
    descripcion text
);
CREATE SEQUENCE public.concepto_pago_id_concepto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.concepto_pago_id_concepto_seq OWNED BY public.concepto_pago.id_concepto;
CREATE TABLE public.curso (
    id_curso integer NOT NULL,
    id_grado integer NOT NULL,
    paralelo character varying(5) NOT NULL,
    id_aula integer NOT NULL,
    id_gestion integer NOT NULL,
    id_profesor integer NOT NULL,
    turno character varying(20) NOT NULL,
    estado boolean DEFAULT true NOT NULL,
    CONSTRAINT curso_turno_check CHECK (((turno)::text = ANY (ARRAY[('Mañana'::character varying)::text, ('Tarde'::character varying)::text])))
);
CREATE SEQUENCE public.curso_id_curso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.curso_id_curso_seq OWNED BY public.curso.id_curso;
CREATE TABLE public.curso_materia (
    id_curso_materia integer NOT NULL,
    id_curso integer NOT NULL,
    id_materia integer NOT NULL,
    id_profesor integer NOT NULL
);
CREATE SEQUENCE public.curso_materia_id_curso_materia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.curso_materia_id_curso_materia_seq OWNED BY public.curso_materia.id_curso_materia;
CREATE TABLE public.deuda (
    id_deuda integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_gestion integer NOT NULL,
    id_concepto integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    mes character varying(20) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_generacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT deuda_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('pagado'::character varying)::text, ('mora'::character varying)::text]))),
    CONSTRAINT deuda_monto_check CHECK ((monto >= (0)::numeric))
);
CREATE SEQUENCE public.deuda_id_deuda_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.deuda_id_deuda_seq OWNED BY public.deuda.id_deuda;
CREATE TABLE public.dimension_evaluacion (
    id_dimension_eval integer NOT NULL,
    nombre_dimension character varying(30) NOT NULL,
    puntaje_maximo numeric(5,2) NOT NULL,
    id_gestion integer NOT NULL,
    CONSTRAINT dimension_evaluacion_nombre_dimension_check CHECK (((nombre_dimension)::text = ANY (ARRAY[('Ser'::character varying)::text, ('Saber'::character varying)::text, ('Hacer'::character varying)::text, ('Autoevaluacion'::character varying)::text])))
);
CREATE SEQUENCE public.dimension_evaluacion_id_dimension_eval_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.dimension_evaluacion_id_dimension_eval_seq OWNED BY public.dimension_evaluacion.id_dimension_eval;
CREATE TABLE public.entrega_estudiante (
    id_entrega integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_tutor integer NOT NULL,
    id_usuario_supervisor integer NOT NULL,
    fecha_hora_entrega timestamp without time zone DEFAULT now() NOT NULL,
    observaciones text
);
CREATE SEQUENCE public.entrega_estudiante_id_entrega_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.entrega_estudiante_id_entrega_seq OWNED BY public.entrega_estudiante.id_entrega;
CREATE TABLE public.estudiante (
    id_estudiante integer NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    ci character varying(20),
    fecha_nacimiento date,
    edad integer,
    genero character varying(20) NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    observaciones text,
    id_usuario integer,
    rude character varying(17),
    CONSTRAINT estudiante_estado_check CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying, 'retirado'::character varying, 'egresado'::character varying])::text[]))),
    CONSTRAINT estudiante_genero_check CHECK (((genero)::text = ANY (ARRAY[('Masculino'::character varying)::text, ('Femenino'::character varying)::text])))
);
CREATE SEQUENCE public.estudiante_id_estudiante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.estudiante_id_estudiante_seq OWNED BY public.estudiante.id_estudiante;
CREATE TABLE public.funcionalidad (
    id_funcionalidad integer NOT NULL,
    metodo character varying(50) NOT NULL,
    descripcion text,
    id_permiso integer NOT NULL,
    id_modulo integer NOT NULL,
    estado boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.funcionalidad_id_funcionalidad_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.funcionalidad_id_funcionalidad_seq OWNED BY public.funcionalidad.id_funcionalidad;
CREATE TABLE public.gestion_academica (
    id_gestion integer NOT NULL,
    anio integer NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    estado character varying(20) DEFAULT 'planificada'::character varying NOT NULL,
    CONSTRAINT gestion_academica_estado_check CHECK (((estado)::text = ANY (ARRAY[('planificada'::character varying)::text, ('activa'::character varying)::text, ('cerrada'::character varying)::text])))
);
CREATE SEQUENCE public.gestion_academica_id_gestion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.gestion_academica_id_gestion_seq OWNED BY public.gestion_academica.id_gestion;
CREATE TABLE public.grado (
    id_grado integer NOT NULL,
    nombre_grado character varying(50) NOT NULL,
    id_nivel integer NOT NULL
);
CREATE SEQUENCE public.grado_id_grado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.grado_id_grado_seq OWNED BY public.grado.id_grado;
CREATE TABLE public.horario (
    id_horario integer NOT NULL,
    id_curso integer NOT NULL,
    id_materia integer,
    dia_semana character varying(10) NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    actividad character varying(100),
    publicado boolean DEFAULT false NOT NULL,
    CONSTRAINT horario_dia_semana_check CHECK (((dia_semana)::text = ANY (ARRAY[('lunes'::character varying)::text, ('martes'::character varying)::text, ('miercoles'::character varying)::text, ('jueves'::character varying)::text, ('viernes'::character varying)::text]))),
    CONSTRAINT horario_hora_fin_check CHECK ((hora_fin > hora_inicio))
);
CREATE SEQUENCE public.horario_id_horario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.horario_id_horario_seq OWNED BY public.horario.id_horario;
CREATE TABLE public.inscripcion (
    id_inscripcion integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_curso integer NOT NULL,
    fecha_inscripcion date DEFAULT CURRENT_DATE NOT NULL,
    estado character varying(20) DEFAULT 'inscrito'::character varying NOT NULL,
    observaciones text,
    CONSTRAINT inscripcion_estado_check CHECK (((estado)::text = ANY (ARRAY[('inscrito'::character varying)::text, ('retirado'::character varying)::text, ('trasladado'::character varying)::text])))
);
CREATE SEQUENCE public.inscripcion_id_inscripcion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.inscripcion_id_inscripcion_seq OWNED BY public.inscripcion.id_inscripcion;
CREATE TABLE public.libreta_emitida (
    id_libreta integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_curso integer NOT NULL,
    id_gestion integer NOT NULL,
    trimestre integer,
    estado character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    id_usuario_aprobador integer,
    fecha_aprobacion timestamp without time zone,
    fecha_entrega timestamp without time zone,
    archivo_pdf_url character varying(255),
    CONSTRAINT libreta_emitida_estado_check CHECK (((estado)::text = ANY (ARRAY[('borrador'::character varying)::text, ('aprobada'::character varying)::text, ('entregada'::character varying)::text]))),
    CONSTRAINT libreta_emitida_trimestre_check CHECK (((trimestre >= 1) AND (trimestre <= 3)))
);
CREATE SEQUENCE public.libreta_emitida_id_libreta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.libreta_emitida_id_libreta_seq OWNED BY public.libreta_emitida.id_libreta;
CREATE TABLE public.materia (
    id_materia integer NOT NULL,
    nombre_materia character varying(100) NOT NULL,
    descripcion text,
    id_campo integer NOT NULL,
    aplica_primaria boolean DEFAULT true NOT NULL,
    estado boolean DEFAULT true NOT NULL
);
CREATE SEQUENCE public.materia_id_materia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.materia_id_materia_seq OWNED BY public.materia.id_materia;
CREATE TABLE public.material (
    id_material integer NOT NULL,
    nombre_item character varying(100) NOT NULL,
    descripcion text,
    categoria character varying(50) NOT NULL,
    stock_actual integer DEFAULT 0 NOT NULL,
    stock_minimo integer DEFAULT 0 NOT NULL,
    estado boolean DEFAULT true NOT NULL,
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT material_stock_actual_check CHECK ((stock_actual >= 0)),
    CONSTRAINT material_stock_minimo_check CHECK ((stock_minimo >= 0))
);
CREATE SEQUENCE public.material_id_material_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.material_id_material_seq OWNED BY public.material.id_material;
CREATE TABLE public.modulo (
    id_modulo integer NOT NULL,
    nombre_modulo character varying(80) NOT NULL,
    descripcion text,
    estado boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.modulo_id_modulo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.modulo_id_modulo_seq OWNED BY public.modulo.id_modulo;
CREATE TABLE public.movimiento_inventario (
    id_movimiento integer NOT NULL,
    id_material integer NOT NULL,
    tipo_movimiento character varying(20) NOT NULL,
    cantidad integer NOT NULL,
    fecha_movimiento timestamp without time zone DEFAULT now() NOT NULL,
    id_usuario integer NOT NULL,
    observaciones text,
    CONSTRAINT movimiento_inventario_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT movimiento_inventario_tipo_movimiento_check CHECK (((tipo_movimiento)::text = ANY (ARRAY[('entrada'::character varying)::text, ('salida'::character varying)::text])))
);
CREATE SEQUENCE public.movimiento_inventario_id_movimiento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.movimiento_inventario_id_movimiento_seq OWNED BY public.movimiento_inventario.id_movimiento;
CREATE TABLE public.nivel (
    id_nivel integer NOT NULL,
    nombre_nivel character varying(50) NOT NULL,
    monto_mensualidad numeric(10,2) DEFAULT 0 NOT NULL
);
CREATE SEQUENCE public.nivel_id_nivel_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.nivel_id_nivel_seq OWNED BY public.nivel.id_nivel;
CREATE TABLE public.notificacion (
    id_notificacion integer NOT NULL,
    id_aviso integer NOT NULL,
    id_tutor integer NOT NULL,
    canal character varying(20) NOT NULL,
    estado_envio character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_envio timestamp without time zone,
    CONSTRAINT notificacion_canal_check CHECK (((canal)::text = ANY (ARRAY[('whatsapp'::character varying)::text, ('email'::character varying)::text, ('sms'::character varying)::text]))),
    CONSTRAINT notificacion_estado_envio_check CHECK (((estado_envio)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('enviado'::character varying)::text, ('fallido'::character varying)::text, ('leido'::character varying)::text])))
);
CREATE SEQUENCE public.notificacion_id_notificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.notificacion_id_notificacion_seq OWNED BY public.notificacion.id_notificacion;
CREATE TABLE public.pago (
    id_pago integer NOT NULL,
    id_deuda integer NOT NULL,
    id_estudiante integer NOT NULL,
    monto_pagado numeric(10,2) NOT NULL,
    metodo_pago character varying(30) NOT NULL,
    comprobante_url character varying(255),
    estado character varying(30) DEFAULT 'pendiente_validacion'::character varying NOT NULL,
    id_usuario_registro integer,
    fecha_pago timestamp without time zone DEFAULT now() NOT NULL,
    observaciones text,
    id_stripe_payment character varying(255),
    CONSTRAINT pago_estado_check CHECK (((estado)::text = ANY (ARRAY['pendiente_validacion'::text, 'validado'::text, 'rechazado'::text, 'completado'::text]))),
    CONSTRAINT pago_metodo_pago_check CHECK (((metodo_pago)::text = ANY (ARRAY['efectivo'::text, 'QR'::text, 'transferencia'::text, 'stripe'::text]))),
    CONSTRAINT pago_monto_pagado_check CHECK ((monto_pagado > (0)::numeric))
);
CREATE SEQUENCE public.pago_id_pago_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.pago_id_pago_seq OWNED BY public.pago.id_pago;
CREATE TABLE public.permiso (
    id_permiso integer NOT NULL,
    nombre_permiso character varying(100) NOT NULL,
    descripcion text
);
CREATE SEQUENCE public.permiso_id_permiso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.permiso_id_permiso_seq OWNED BY public.permiso.id_permiso;
CREATE TABLE public.profesor (
    id_profesor integer NOT NULL,
    id_usuario integer,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    ci character varying(20) NOT NULL,
    profesion character varying(100),
    genero character varying(20) NOT NULL,
    estado boolean DEFAULT true NOT NULL,
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT profesor_genero_check CHECK (((genero)::text = ANY (ARRAY[('Masculino'::character varying)::text, ('Femenino'::character varying)::text])))
);
CREATE SEQUENCE public.profesor_id_profesor_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.profesor_id_profesor_seq OWNED BY public.profesor.id_profesor;
CREATE TABLE public.rol (
    id_rol integer NOT NULL,
    nombre_rol character varying(50) NOT NULL,
    descripcion text,
    estado boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.rol_funcionalidad (
    id_rol integer NOT NULL,
    id_funcionalidad integer NOT NULL,
    fecha_asignacion timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.rol_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.rol_id_rol_seq OWNED BY public.rol.id_rol;
CREATE TABLE public.rol_permiso (
    id_rol integer NOT NULL,
    id_permiso integer NOT NULL
);
CREATE TABLE public.tutor (
    id_tutor integer NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    ci character varying(20) NOT NULL,
    genero character varying(20) NOT NULL,
    telefono character varying(20),
    correo_electronico character varying(100),
    direccion text,
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT tutor_genero_check CHECK (((genero)::text = ANY (ARRAY[('Masculino'::character varying)::text, ('Femenino'::character varying)::text])))
);
CREATE TABLE public.tutor_estudiante (
    id_tutor_estudiante integer NOT NULL,
    id_tutor integer NOT NULL,
    id_estudiante integer NOT NULL,
    parentesco character varying(30) NOT NULL,
    autorizado_recoger boolean DEFAULT true NOT NULL,
    contacto_emergencia boolean DEFAULT false NOT NULL
);
CREATE SEQUENCE public.tutor_estudiante_id_tutor_estudiante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tutor_estudiante_id_tutor_estudiante_seq OWNED BY public.tutor_estudiante.id_tutor_estudiante;
CREATE SEQUENCE public.tutor_id_tutor_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tutor_id_tutor_seq OWNED BY public.tutor.id_tutor;
CREATE TABLE public.usuario (
    id_usuario integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    id_rol integer NOT NULL,
    estado boolean DEFAULT true NOT NULL,
    ultimo_acceso timestamp without time zone,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    email character varying(100),
    intentos_fallidos integer DEFAULT 0 NOT NULL,
    bloqueado_hasta timestamp without time zone,
    reset_token character varying(255),
    reset_token_expira timestamp without time zone
);
CREATE SEQUENCE public.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.usuario_id_usuario_seq OWNED BY public.usuario.id_usuario;
ALTER TABLE ONLY public.actividad_evaluacion ALTER COLUMN id_actividad SET DEFAULT nextval('public.actividad_evaluacion_id_actividad_seq'::regclass);
ALTER TABLE ONLY public.asistencia ALTER COLUMN id_asistencia SET DEFAULT nextval('public.asistencia_id_asistencia_seq'::regclass);
ALTER TABLE ONLY public.aula ALTER COLUMN id_aula SET DEFAULT nextval('public.aula_id_aula_seq'::regclass);
ALTER TABLE ONLY public.aviso ALTER COLUMN id_aviso SET DEFAULT nextval('public.aviso_id_aviso_seq'::regclass);
ALTER TABLE ONLY public.bitacora ALTER COLUMN id_bitacora SET DEFAULT nextval('public.bitacora_id_bitacora_seq'::regclass);
ALTER TABLE ONLY public.calificacion ALTER COLUMN id_calificacion SET DEFAULT nextval('public.calificacion_id_calificacion_seq'::regclass);
ALTER TABLE ONLY public.campo_saber ALTER COLUMN id_campo SET DEFAULT nextval('public.campo_saber_id_campo_seq'::regclass);
ALTER TABLE ONLY public.comprobante ALTER COLUMN id_comprobante SET DEFAULT nextval('public.comprobante_id_comprobante_seq'::regclass);
ALTER TABLE ONLY public.concepto_pago ALTER COLUMN id_concepto SET DEFAULT nextval('public.concepto_pago_id_concepto_seq'::regclass);
ALTER TABLE ONLY public.curso ALTER COLUMN id_curso SET DEFAULT nextval('public.curso_id_curso_seq'::regclass);
ALTER TABLE ONLY public.curso_materia ALTER COLUMN id_curso_materia SET DEFAULT nextval('public.curso_materia_id_curso_materia_seq'::regclass);
ALTER TABLE ONLY public.deuda ALTER COLUMN id_deuda SET DEFAULT nextval('public.deuda_id_deuda_seq'::regclass);
ALTER TABLE ONLY public.dimension_evaluacion ALTER COLUMN id_dimension_eval SET DEFAULT nextval('public.dimension_evaluacion_id_dimension_eval_seq'::regclass);
ALTER TABLE ONLY public.entrega_estudiante ALTER COLUMN id_entrega SET DEFAULT nextval('public.entrega_estudiante_id_entrega_seq'::regclass);
ALTER TABLE ONLY public.estudiante ALTER COLUMN id_estudiante SET DEFAULT nextval('public.estudiante_id_estudiante_seq'::regclass);
ALTER TABLE ONLY public.funcionalidad ALTER COLUMN id_funcionalidad SET DEFAULT nextval('public.funcionalidad_id_funcionalidad_seq'::regclass);
ALTER TABLE ONLY public.gestion_academica ALTER COLUMN id_gestion SET DEFAULT nextval('public.gestion_academica_id_gestion_seq'::regclass);
ALTER TABLE ONLY public.grado ALTER COLUMN id_grado SET DEFAULT nextval('public.grado_id_grado_seq'::regclass);
ALTER TABLE ONLY public.horario ALTER COLUMN id_horario SET DEFAULT nextval('public.horario_id_horario_seq'::regclass);
ALTER TABLE ONLY public.inscripcion ALTER COLUMN id_inscripcion SET DEFAULT nextval('public.inscripcion_id_inscripcion_seq'::regclass);
ALTER TABLE ONLY public.libreta_emitida ALTER COLUMN id_libreta SET DEFAULT nextval('public.libreta_emitida_id_libreta_seq'::regclass);
ALTER TABLE ONLY public.materia ALTER COLUMN id_materia SET DEFAULT nextval('public.materia_id_materia_seq'::regclass);
ALTER TABLE ONLY public.material ALTER COLUMN id_material SET DEFAULT nextval('public.material_id_material_seq'::regclass);
ALTER TABLE ONLY public.modulo ALTER COLUMN id_modulo SET DEFAULT nextval('public.modulo_id_modulo_seq'::regclass);
ALTER TABLE ONLY public.movimiento_inventario ALTER COLUMN id_movimiento SET DEFAULT nextval('public.movimiento_inventario_id_movimiento_seq'::regclass);
ALTER TABLE ONLY public.nivel ALTER COLUMN id_nivel SET DEFAULT nextval('public.nivel_id_nivel_seq'::regclass);
ALTER TABLE ONLY public.notificacion ALTER COLUMN id_notificacion SET DEFAULT nextval('public.notificacion_id_notificacion_seq'::regclass);
ALTER TABLE ONLY public.pago ALTER COLUMN id_pago SET DEFAULT nextval('public.pago_id_pago_seq'::regclass);
ALTER TABLE ONLY public.permiso ALTER COLUMN id_permiso SET DEFAULT nextval('public.permiso_id_permiso_seq'::regclass);
ALTER TABLE ONLY public.profesor ALTER COLUMN id_profesor SET DEFAULT nextval('public.profesor_id_profesor_seq'::regclass);
ALTER TABLE ONLY public.rol ALTER COLUMN id_rol SET DEFAULT nextval('public.rol_id_rol_seq'::regclass);
ALTER TABLE ONLY public.tutor ALTER COLUMN id_tutor SET DEFAULT nextval('public.tutor_id_tutor_seq'::regclass);
ALTER TABLE ONLY public.tutor_estudiante ALTER COLUMN id_tutor_estudiante SET DEFAULT nextval('public.tutor_estudiante_id_tutor_estudiante_seq'::regclass);
ALTER TABLE ONLY public.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuario_id_usuario_seq'::regclass);
ALTER TABLE public.aviso ADD COLUMN id_estudiante_destino INTEGER NULL; -- NUEVO
ALTER TABLE public.notificacion DROP CONSTRAINT notificacion_canal_check; -- nuevo
ALTER TABLE public.notificacion ADD CONSTRAINT notificacion_canal_check --nuevo
  CHECK (canal IN ('whatsapp','email','sms','panel')); -- nuevo
ALTER TABLE public.bitacora DROP CONSTRAINT bitacora_accion_check;
ALTER TABLE public.bitacora ADD CONSTRAINT bitacora_accion_check
  CHECK (accion IN ('LOGIN','LOGOUT','INSERT','UPDATE','DELETE','APROBACION',
                    'VALIDACION','EXPORTACION','CONSULTA','SISTEMA','ERROR','ADVERTENCIA'));

INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (1, 5, 2, 1, 'Practica demo de lectura', '2026-04-15');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (2, 30, 1, 1, 'Valoración actitudinal - Valores', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (3, 30, 2, 1, 'Evaluación valores comunitarios', '2026-03-20');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (4, 30, 2, 1, 'Evaluación convivencia y respeto', '2026-04-15');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (5, 30, 3, 1, 'Dramatización de valores', '2026-03-27');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (6, 30, 3, 1, 'Proyecto de solidaridad', '2026-04-24');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (7, 30, 4, 1, 'Autoevaluación - Valores T1', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (8, 28, 1, 1, 'Valoración actitudinal - CC.NN.', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (9, 28, 2, 1, 'Evaluación de seres vivos', '2026-03-19');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (10, 28, 2, 1, 'Evaluación del cuerpo humano', '2026-04-16');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (11, 28, 3, 1, 'Herbario con hojas del patio', '2026-03-26');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (12, 28, 3, 1, 'Maqueta del sistema digestivo', '2026-04-23');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (13, 28, 4, 1, 'Autoevaluación - CC.NN. T1', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (14, 25, 1, 1, 'Valoración actitudinal - Téc. Tecnológica', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (15, 25, 2, 1, 'Evaluación herramientas básicas', '2026-03-21');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (16, 25, 2, 1, 'Evaluación producción artesanal', '2026-04-17');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (17, 25, 3, 1, 'Construcción materiales reciclados', '2026-03-28');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (18, 25, 3, 1, 'Proyecto productivo: huerto escolar', '2026-04-25');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (19, 25, 4, 1, 'Autoevaluación - Téc. Tecnológica T1', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (20, 26, 1, 1, 'Valoración actitudinal - Matemática', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (21, 26, 2, 1, 'Examen números del 1 al 100', '2026-03-17');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (22, 26, 2, 1, 'Evaluación de sumas y restas', '2026-04-14');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (23, 26, 3, 1, 'Tarea problemas material concreto', '2026-03-24');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (24, 26, 3, 1, 'Proyecto de tiendita escolar', '2026-04-21');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (25, 26, 4, 1, 'Autoevaluación - Matemática T1', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (26, 18, 1, 1, 'Valoración actitudinal - Música', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (27, 18, 2, 1, 'Evaluación notas musicales básicas', '2026-03-19');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (28, 18, 2, 1, 'Evaluación de ritmo y compás', '2026-04-16');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (29, 18, 3, 1, 'Interpretación canción infantil', '2026-03-26');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (30, 18, 3, 1, 'Presentación grupal con instrumentos', '2026-04-23');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (31, 18, 4, 1, 'Autoevaluación - Música T1', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (32, 19, 1, 1, 'Valoración actitudinal - Ed. Física', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (33, 19, 2, 1, 'Evaluación teórica higiene corporal', '2026-03-20');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (34, 19, 2, 1, 'Evaluación reglas deportivas básicas', '2026-04-15');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (35, 19, 3, 1, 'Circuito habilidades motrices', '2026-03-27');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (36, 19, 3, 1, 'Mini torneo de relevos', '2026-04-24');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (37, 19, 4, 1, 'Autoevaluación - Ed. Física T1', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (38, 20, 1, 1, 'Valoración actitudinal - Artes', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (39, 20, 2, 1, 'Evaluación de colores y formas', '2026-03-15');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (40, 20, 2, 1, 'Evaluación de técnicas de pintura', '2026-04-12');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (41, 20, 3, 1, 'Pintura con témperas: paisaje', '2026-03-22');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (42, 20, 3, 1, 'Manualidad con material reciclado', '2026-04-18');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (43, 20, 4, 1, 'Autoevaluación - Artes T1', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (44, 21, 1, 1, 'Valoración actitudinal - CC.SS.', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (45, 21, 2, 1, 'Evaluación de comunidad y familia', '2026-03-18');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (46, 21, 2, 1, 'Evaluación de Bolivia y sus símbolos', '2026-04-10');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (47, 21, 3, 1, 'Maqueta de mi barrio', '2026-03-28');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (48, 21, 3, 1, 'Collage de fiestas bolivianas', '2026-04-22');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (49, 21, 4, 1, 'Autoevaluación - CC.SS. T1', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (50, 22, 1, 1, 'Valoración actitudinal - Lenguaje', '2026-04-30');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (51, 22, 2, 1, 'Examen de lectura comprensiva', '2026-03-20');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (52, 22, 2, 1, 'Evaluación de escritura creativa', '2026-04-15');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (53, 22, 3, 1, 'Tarea de caligrafía y dictado', '2026-03-25');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (54, 22, 3, 1, 'Proyecto de cuento ilustrado', '2026-04-20');
INSERT INTO public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) VALUES (55, 22, 4, 1, 'Autoevaluación - Lenguaje T1', '2026-04-30');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (1, 5, 1, '2026-05-04', 'J', 'Cita medica', 4, '2026-05-06 13:36:59.335787');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (2, 1, 2, '2026-05-04', 'P', NULL, 4, '2026-05-06 13:36:59.335787');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (3, 2, 2, '2026-05-04', 'T', 'Llego 10 minutos tarde', 4, '2026-05-06 13:36:59.335787');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (4, 3, 3, '2026-05-04', 'P', NULL, 4, '2026-05-06 13:36:59.335787');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (5, 4, 3, '2026-05-04', 'A', 'Sin justificativo', 4, '2026-05-06 13:36:59.335787');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (6, 6, 9, '2026-03-23', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (7, 7, 9, '2026-03-23', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (8, 8, 9, '2026-03-23', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (9, 9, 9, '2026-03-23', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (10, 10, 9, '2026-03-23', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (11, 11, 9, '2026-03-23', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (12, 12, 9, '2026-03-23', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (13, 13, 9, '2026-03-23', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (14, 14, 9, '2026-03-23', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (15, 15, 9, '2026-03-23', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (16, 6, 9, '2026-03-24', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (17, 7, 9, '2026-03-24', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (18, 8, 9, '2026-03-24', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (19, 9, 9, '2026-03-24', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (20, 10, 9, '2026-03-24', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (21, 11, 9, '2026-03-24', 'T', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (22, 12, 9, '2026-03-24', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (23, 13, 9, '2026-03-24', 'A', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (24, 14, 9, '2026-03-24', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (25, 15, 9, '2026-03-24', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (26, 6, 9, '2026-03-25', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (27, 7, 9, '2026-03-25', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (28, 8, 9, '2026-03-25', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (29, 9, 9, '2026-03-25', 'A', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (30, 10, 9, '2026-03-25', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (31, 11, 9, '2026-03-25', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (32, 12, 9, '2026-03-25', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (33, 13, 9, '2026-03-25', 'A', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (34, 14, 9, '2026-03-25', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (35, 15, 9, '2026-03-25', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (36, 6, 9, '2026-03-26', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (37, 7, 9, '2026-03-26', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (38, 8, 9, '2026-03-26', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (39, 9, 9, '2026-03-26', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (40, 10, 9, '2026-03-26', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (41, 11, 9, '2026-03-26', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (42, 12, 9, '2026-03-26', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (43, 13, 9, '2026-03-26', 'A', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (44, 14, 9, '2026-03-26', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (45, 15, 9, '2026-03-26', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (46, 6, 9, '2026-03-27', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (47, 7, 9, '2026-03-27', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (48, 8, 9, '2026-03-27', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (49, 9, 9, '2026-03-27', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (50, 10, 9, '2026-03-27', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (51, 11, 9, '2026-03-27', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (52, 12, 9, '2026-03-27', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (53, 13, 9, '2026-03-27', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (54, 14, 9, '2026-03-27', 'J', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) VALUES (55, 15, 9, '2026-03-27', 'P', NULL, 21, '2026-05-06 21:47:58.580502');
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (1, 'A-101', 'Aula inicial con rincon de lectura', 14, 28, 28);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (2, 'A-102', 'Aula primaria equipada', 18, 36, 36);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (3, 'A-103', 'Aula primaria equipada', 18, 36, 36);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (4, 'B-201', 'Aula secundaria', 20, 40, 40);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (14, 'A-01', 'Planta baja ala sur', 10, 20, 20);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (15, 'A-02', 'Planta baja ala sur', 12, 24, 24);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (16, 'A-03', 'Planta baja ala norte', 15, 30, 30);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (17, 'A-04', 'Planta baja ala norte', 15, 30, 30);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (18, 'A-05', 'Primer piso ala sur', 15, 30, 30);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (19, 'A-06', 'Primer piso ala sur', 15, 30, 30);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (20, 'A-07', 'Primer piso ala norte', 15, 30, 30);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (21, 'A-08', 'Primer piso ala norte', 15, 30, 30);
INSERT INTO public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES (22, 'MULTI', 'Salón multiuso', 0, 0, 80);
INSERT INTO public.aviso (id_aviso, titulo, contenido, id_usuario, destinatario_tipo, id_curso_destino, fecha_envio, estado) VALUES (1, 'Reunion de padres demo', 'Se convoca a reunion informativa para revisar avance academico.', 4, 'por_curso', 2, '2026-05-06 08:00:00', 'enviado');
INSERT INTO public.aviso (id_aviso, titulo, contenido, id_usuario, destinatario_tipo, id_curso_destino, fecha_envio, estado) VALUES (2, 'Reunión padres 1er trimestre', 'Se convoca a reunión para entrega de libretas viernes 15 mayo hrs 15:00.', 16, 'por_curso', 9, '2026-05-05 10:00:00', 'enviado');
INSERT INTO public.aviso (id_aviso, titulo, contenido, id_usuario, destinatario_tipo, id_curso_destino, fecha_envio, estado) VALUES (3, 'Recordatorio pago marzo', 'Mensualidad marzo pendiente. Favor regularizar.', 22, 'por_curso', 9, '2026-03-20 09:00:00', 'enviado');
INSERT INTO public.aviso (id_aviso, titulo, contenido, id_usuario, destinatario_tipo, id_curso_destino, fecha_envio, estado) VALUES (4, 'Feria educativa 2026', 'Feria Educativa sábado 20 junio.', 16, 'todos', NULL, '2026-05-15 08:00:00', 'enviado');
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (1, 4, 8, 37, 'INSERT', 'asistencia', 1, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 13:36:59.335787', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (2, 4, 8, 37, 'INSERT', 'asistencia', 2, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 13:36:59.335787', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (3, 4, 8, 37, 'INSERT', 'asistencia', 3, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 13:36:59.335787', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (4, 4, 8, 37, 'INSERT', 'asistencia', 4, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 13:36:59.335787', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (5, 4, 8, 37, 'INSERT', 'asistencia', 5, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 13:36:59.335787', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (6, 4, 10, 40, 'INSERT', 'pago', 1, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 13:36:59.335787', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (7, 4, 10, 40, 'INSERT', 'pago', 2, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 13:36:59.335787', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (8, 1, 3, 11, 'LOGIN', 'usuario', 1, 'Inicio de sesion de superuser', '2026-05-06 14:14:15.821419', '::ffff:127.0.0.1');
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (9, 1, 3, 11, 'LOGIN', 'usuario', 1, 'Inicio de sesion de superuser', '2026-05-06 18:47:07.732909', '::ffff:127.0.0.1');
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (10, 21, 8, 37, 'INSERT', 'asistencia', 6, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (11, 21, 8, 37, 'INSERT', 'asistencia', 7, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (12, 21, 8, 37, 'INSERT', 'asistencia', 8, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (13, 21, 8, 37, 'INSERT', 'asistencia', 9, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (14, 21, 8, 37, 'INSERT', 'asistencia', 10, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (15, 21, 8, 37, 'INSERT', 'asistencia', 11, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (16, 21, 8, 37, 'INSERT', 'asistencia', 12, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (17, 21, 8, 37, 'INSERT', 'asistencia', 13, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (18, 21, 8, 37, 'INSERT', 'asistencia', 14, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (19, 21, 8, 37, 'INSERT', 'asistencia', 15, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (20, 21, 8, 37, 'INSERT', 'asistencia', 16, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (21, 21, 8, 37, 'INSERT', 'asistencia', 17, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (22, 21, 8, 37, 'INSERT', 'asistencia', 18, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (23, 21, 8, 37, 'INSERT', 'asistencia', 19, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (24, 21, 8, 37, 'INSERT', 'asistencia', 20, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (25, 21, 8, 37, 'INSERT', 'asistencia', 21, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (26, 21, 8, 37, 'INSERT', 'asistencia', 22, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (27, 21, 8, 37, 'INSERT', 'asistencia', 23, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (28, 21, 8, 37, 'INSERT', 'asistencia', 24, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (29, 21, 8, 37, 'INSERT', 'asistencia', 25, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (30, 21, 8, 37, 'INSERT', 'asistencia', 26, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (31, 21, 8, 37, 'INSERT', 'asistencia', 27, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (32, 21, 8, 37, 'INSERT', 'asistencia', 28, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (33, 21, 8, 37, 'INSERT', 'asistencia', 29, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (34, 21, 8, 37, 'INSERT', 'asistencia', 30, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (35, 21, 8, 37, 'INSERT', 'asistencia', 31, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (36, 21, 8, 37, 'INSERT', 'asistencia', 32, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (37, 21, 8, 37, 'INSERT', 'asistencia', 33, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (38, 21, 8, 37, 'INSERT', 'asistencia', 34, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (39, 21, 8, 37, 'INSERT', 'asistencia', 35, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (40, 21, 8, 37, 'INSERT', 'asistencia', 36, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (41, 21, 8, 37, 'INSERT', 'asistencia', 37, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (42, 21, 8, 37, 'INSERT', 'asistencia', 38, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (43, 21, 8, 37, 'INSERT', 'asistencia', 39, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (44, 21, 8, 37, 'INSERT', 'asistencia', 40, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (45, 21, 8, 37, 'INSERT', 'asistencia', 41, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (46, 21, 8, 37, 'INSERT', 'asistencia', 42, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (47, 21, 8, 37, 'INSERT', 'asistencia', 43, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (48, 21, 8, 37, 'INSERT', 'asistencia', 44, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (49, 21, 8, 37, 'INSERT', 'asistencia', 45, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (50, 21, 8, 37, 'INSERT', 'asistencia', 46, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (51, 21, 8, 37, 'INSERT', 'asistencia', 47, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (52, 21, 8, 37, 'INSERT', 'asistencia', 48, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (53, 21, 8, 37, 'INSERT', 'asistencia', 49, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (54, 21, 8, 37, 'INSERT', 'asistencia', 50, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (55, 21, 8, 37, 'INSERT', 'asistencia', 51, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (56, 21, 8, 37, 'INSERT', 'asistencia', 52, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (57, 21, 8, 37, 'INSERT', 'asistencia', 53, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (58, 21, 8, 37, 'INSERT', 'asistencia', 54, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (59, 21, 8, 37, 'INSERT', 'asistencia', 55, 'Se registró o actualizó asistencia estudiantil.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (60, 22, 10, 40, 'INSERT', 'pago', 3, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (61, 22, 10, 40, 'INSERT', 'pago', 4, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (62, 22, 10, 40, 'INSERT', 'pago', 5, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (63, 22, 10, 40, 'INSERT', 'pago', 6, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (64, 22, 10, 40, 'INSERT', 'pago', 7, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (65, 22, 10, 40, 'INSERT', 'pago', 8, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (66, 22, 10, 40, 'INSERT', 'pago', 9, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (67, 22, 10, 40, 'INSERT', 'pago', 10, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (68, 22, 10, 40, 'INSERT', 'pago', 11, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (69, 22, 10, 40, 'INSERT', 'pago', 12, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (70, 22, 10, 40, 'INSERT', 'pago', 13, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (71, 22, 10, 40, 'INSERT', 'pago', 14, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (72, 22, 10, 40, 'INSERT', 'pago', 15, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (73, 22, 10, 40, 'INSERT', 'pago', 16, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (74, 22, 10, 40, 'INSERT', 'pago', 17, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (75, 22, 10, 40, 'INSERT', 'pago', 18, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (76, 22, 10, 40, 'INSERT', 'pago', 19, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (77, 22, 10, 40, 'INSERT', 'pago', 20, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (78, 22, 10, 40, 'INSERT', 'pago', 21, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (79, 22, 10, 40, 'INSERT', 'pago', 22, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (80, 22, 10, 40, 'INSERT', 'pago', 23, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (81, 22, 10, 40, 'INSERT', 'pago', 24, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (82, 22, 10, 40, 'INSERT', 'pago', 25, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (83, 22, 10, 40, 'INSERT', 'pago', 26, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (84, 22, 10, 40, 'INSERT', 'pago', 27, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (85, 22, 10, 40, 'INSERT', 'pago', 28, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (86, 22, 10, 40, 'INSERT', 'pago', 29, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) VALUES (87, 22, 10, 40, 'INSERT', 'pago', 30, 'Se registró o actualizó un pago en el sistema.', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (1, 1, 1, 31.00, '2026-04-16', 'Calificacion demo');
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (2, 1, 2, 28.00, '2026-04-16', 'Calificacion demo');
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (3, 53, 15, 26.62, '2026-03-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (4, 52, 15, 31.83, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (5, 51, 15, 36.96, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (6, 50, 15, 7.74, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (7, 53, 9, 29.35, '2026-03-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (8, 52, 9, 31.44, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (9, 51, 9, 33.67, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (10, 50, 6, 9.28, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (11, 50, 9, 7.72, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (12, 55, 6, 4.18, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (13, 52, 6, 39.16, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (14, 55, 14, 4.59, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (15, 54, 14, 34.46, '2026-04-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (16, 53, 14, 37.94, '2026-03-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (17, 52, 14, 40.96, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (18, 51, 14, 38.03, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (19, 50, 14, 8.05, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (20, 53, 6, 28.49, '2026-03-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (21, 55, 12, 5.00, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (22, 54, 12, 31.85, '2026-04-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (23, 53, 12, 35.94, '2026-03-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (24, 52, 12, 34.22, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (25, 51, 12, 35.48, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (26, 50, 12, 7.99, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (27, 54, 6, 31.48, '2026-04-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (28, 55, 9, 3.23, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (29, 54, 9, 26.63, '2026-04-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (30, 55, 15, 3.52, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (31, 54, 15, 30.88, '2026-04-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (32, 55, 13, 2.39, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (33, 55, 11, 3.80, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (34, 54, 11, 25.84, '2026-04-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (35, 53, 11, 29.49, '2026-03-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (36, 52, 11, 34.58, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (37, 51, 11, 29.81, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (38, 50, 11, 6.36, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (39, 54, 13, 15.92, '2026-04-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (40, 53, 13, 14.30, '2026-03-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (41, 52, 13, 19.11, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (42, 51, 13, 21.13, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (43, 50, 13, 4.05, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (44, 50, 7, 7.24, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (45, 55, 10, 4.14, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (46, 54, 10, 32.16, '2026-04-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (47, 53, 10, 30.63, '2026-03-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (48, 52, 10, 32.76, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (49, 51, 10, 31.81, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (50, 50, 10, 8.23, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (51, 50, 8, 7.72, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (52, 51, 8, 45.00, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (53, 52, 8, 39.47, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (54, 53, 8, 39.24, '2026-03-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (55, 54, 8, 34.44, '2026-04-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (56, 55, 8, 3.85, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (57, 51, 7, 28.80, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (58, 52, 7, 36.03, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (59, 53, 7, 30.20, '2026-03-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (60, 54, 7, 28.88, '2026-04-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (61, 55, 7, 4.31, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (62, 51, 6, 36.18, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (63, 49, 8, 5.00, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (64, 44, 6, 7.77, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (65, 49, 9, 3.01, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (66, 48, 9, 27.25, '2026-04-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (67, 47, 9, 24.69, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (68, 46, 9, 27.99, '2026-04-10', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (69, 45, 9, 34.47, '2026-03-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (70, 44, 9, 5.84, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (71, 49, 15, 4.31, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (72, 48, 15, 29.13, '2026-04-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (73, 47, 15, 30.15, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (74, 46, 15, 31.36, '2026-04-10', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (75, 45, 15, 37.99, '2026-03-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (76, 44, 15, 8.46, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (77, 49, 14, 3.68, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (78, 48, 14, 30.09, '2026-04-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (79, 47, 14, 36.54, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (80, 46, 14, 41.35, '2026-04-10', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (81, 45, 14, 40.29, '2026-03-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (82, 44, 14, 7.55, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (83, 49, 13, 2.04, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (84, 48, 13, 14.95, '2026-04-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (85, 47, 13, 14.79, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (86, 46, 13, 19.72, '2026-04-10', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (87, 45, 13, 20.69, '2026-03-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (88, 44, 13, 4.42, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (89, 44, 7, 7.83, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (90, 45, 7, 32.18, '2026-03-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (91, 46, 7, 31.09, '2026-04-10', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (92, 47, 7, 33.59, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (93, 48, 7, 26.05, '2026-04-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (94, 49, 7, 3.31, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (95, 45, 6, 39.15, '2026-03-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (96, 46, 6, 41.89, '2026-04-10', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (97, 47, 6, 29.09, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (98, 48, 6, 29.32, '2026-04-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (99, 49, 6, 4.63, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (100, 49, 12, 4.75, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (101, 48, 12, 37.21, '2026-04-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (102, 47, 12, 37.22, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (103, 46, 12, 41.88, '2026-04-10', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (104, 45, 12, 36.35, '2026-03-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (105, 44, 12, 8.25, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (106, 49, 11, 4.06, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (107, 48, 11, 27.25, '2026-04-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (108, 47, 11, 32.09, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (109, 46, 11, 30.15, '2026-04-10', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (110, 45, 11, 33.64, '2026-03-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (111, 44, 11, 7.30, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (112, 49, 10, 4.38, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (113, 48, 10, 31.88, '2026-04-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (114, 47, 10, 30.72, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (115, 46, 10, 40.16, '2026-04-10', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (116, 45, 10, 36.83, '2026-03-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (117, 44, 10, 8.20, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (118, 44, 8, 10.00, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (119, 45, 8, 35.72, '2026-03-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (120, 46, 8, 37.33, '2026-04-10', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (121, 47, 8, 31.16, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (122, 48, 8, 36.27, '2026-04-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (123, 39, 7, 35.26, '2026-03-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (124, 38, 6, 7.78, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (125, 39, 6, 33.83, '2026-03-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (126, 40, 6, 40.91, '2026-04-12', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (127, 41, 6, 36.22, '2026-03-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (128, 42, 6, 28.43, '2026-04-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (129, 43, 6, 4.37, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (130, 38, 7, 7.41, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (131, 40, 7, 34.44, '2026-04-12', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (132, 41, 7, 30.57, '2026-03-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (133, 42, 7, 27.39, '2026-04-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (134, 43, 7, 3.76, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (135, 38, 8, 10.00, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (136, 39, 8, 45.00, '2026-03-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (137, 40, 8, 43.27, '2026-04-12', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (138, 41, 8, 40.00, '2026-03-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (139, 42, 8, 32.89, '2026-04-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (140, 43, 8, 4.14, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (141, 38, 9, 7.64, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (142, 39, 9, 33.74, '2026-03-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (143, 40, 9, 28.89, '2026-04-12', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (144, 41, 9, 28.75, '2026-03-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (145, 42, 9, 24.34, '2026-04-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (146, 43, 9, 3.30, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (147, 38, 10, 8.93, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (148, 39, 10, 32.85, '2026-03-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (149, 40, 10, 34.78, '2026-04-12', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (150, 41, 10, 28.12, '2026-03-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (151, 42, 10, 33.37, '2026-04-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (152, 43, 10, 3.85, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (153, 38, 11, 8.21, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (154, 39, 11, 36.45, '2026-03-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (155, 40, 11, 30.62, '2026-04-12', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (156, 41, 11, 32.66, '2026-03-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (157, 42, 11, 30.07, '2026-04-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (158, 43, 11, 3.15, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (159, 38, 12, 9.90, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (160, 39, 12, 37.44, '2026-03-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (161, 40, 12, 40.64, '2026-04-12', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (162, 41, 12, 40.00, '2026-03-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (163, 42, 12, 31.51, '2026-04-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (164, 43, 12, 3.75, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (165, 38, 13, 4.10, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (166, 39, 13, 18.01, '2026-03-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (167, 40, 13, 21.11, '2026-04-12', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (168, 41, 13, 15.58, '2026-03-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (169, 42, 13, 18.16, '2026-04-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (170, 43, 13, 2.28, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (171, 38, 14, 8.49, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (172, 39, 14, 41.01, '2026-03-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (173, 40, 14, 41.11, '2026-04-12', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (174, 41, 14, 31.34, '2026-03-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (175, 42, 14, 37.39, '2026-04-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (176, 43, 14, 3.82, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (177, 38, 15, 7.49, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (178, 39, 15, 29.64, '2026-03-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (179, 40, 15, 33.88, '2026-04-12', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (180, 41, 15, 28.27, '2026-03-22', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (181, 42, 15, 31.77, '2026-04-18', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (182, 43, 15, 3.53, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (183, 32, 8, 8.51, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (184, 33, 8, 36.31, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (185, 34, 8, 41.61, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (186, 35, 8, 35.01, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (187, 36, 8, 34.09, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (188, 37, 8, 4.55, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (189, 37, 13, 2.08, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (190, 36, 13, 14.40, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (191, 35, 13, 16.29, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (192, 34, 13, 16.72, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (193, 33, 13, 18.32, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (194, 32, 13, 3.64, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (195, 32, 6, 8.21, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (196, 33, 6, 35.94, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (197, 34, 6, 42.29, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (198, 35, 6, 35.87, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (199, 36, 6, 36.87, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (200, 37, 6, 4.23, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (201, 32, 15, 6.80, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (202, 33, 15, 32.28, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (203, 34, 15, 36.18, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (204, 35, 15, 35.18, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (205, 36, 15, 27.46, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (206, 37, 15, 4.25, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (207, 32, 10, 7.10, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (208, 33, 10, 30.17, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (209, 34, 10, 37.89, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (210, 35, 10, 29.41, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (211, 36, 10, 27.02, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (212, 37, 10, 4.36, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (213, 32, 9, 6.94, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (214, 32, 11, 7.99, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (215, 33, 11, 31.32, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (216, 34, 11, 30.97, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (217, 35, 11, 30.91, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (218, 36, 11, 28.87, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (219, 37, 11, 3.33, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (220, 33, 9, 28.05, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (221, 34, 9, 26.94, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (222, 35, 9, 26.82, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (223, 36, 9, 29.64, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (224, 37, 9, 2.94, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (225, 37, 14, 3.79, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (226, 36, 14, 31.06, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (227, 35, 14, 29.12, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (228, 34, 14, 42.14, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (229, 33, 14, 37.15, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (230, 32, 14, 9.01, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (231, 37, 7, 3.44, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (232, 36, 7, 30.15, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (233, 35, 7, 28.78, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (234, 34, 7, 28.97, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (235, 33, 7, 34.53, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (236, 32, 7, 7.90, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (237, 32, 12, 8.06, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (238, 33, 12, 45.00, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (239, 34, 12, 45.00, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (240, 35, 12, 38.42, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (241, 36, 12, 34.27, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (242, 37, 12, 4.06, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (243, 26, 12, 7.93, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (244, 27, 10, 34.94, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (245, 28, 10, 33.22, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (246, 29, 10, 30.23, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (247, 30, 10, 33.62, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (248, 31, 10, 3.57, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (249, 27, 9, 31.56, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (250, 28, 9, 26.72, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (251, 29, 9, 30.75, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (252, 30, 9, 29.89, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (253, 31, 9, 3.09, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (254, 26, 6, 8.24, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (255, 27, 6, 31.43, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (256, 28, 6, 36.61, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (257, 29, 6, 37.65, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (258, 30, 6, 29.64, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (259, 31, 6, 4.47, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (260, 26, 10, 7.86, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (261, 26, 15, 6.74, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (262, 27, 15, 38.44, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (263, 28, 15, 37.16, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (264, 29, 15, 26.43, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (265, 30, 15, 31.19, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (266, 31, 15, 3.94, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (267, 27, 12, 41.12, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (268, 28, 12, 40.73, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (269, 29, 12, 33.82, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (270, 30, 12, 36.20, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (271, 31, 12, 4.66, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (272, 26, 11, 6.27, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (273, 27, 11, 35.05, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (274, 28, 11, 35.57, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (275, 29, 11, 25.18, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (276, 30, 11, 32.51, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (277, 31, 11, 3.72, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (278, 31, 13, 1.99, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (279, 30, 13, 19.13, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (280, 29, 13, 19.21, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (281, 28, 13, 20.13, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (282, 27, 13, 21.55, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (283, 26, 13, 4.03, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (284, 26, 9, 6.55, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (285, 26, 8, 10.00, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (286, 27, 8, 42.20, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (287, 28, 8, 37.24, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (288, 29, 8, 30.99, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (289, 30, 8, 35.11, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (290, 31, 8, 4.44, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (291, 31, 14, 3.99, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (292, 30, 14, 34.13, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (293, 29, 14, 29.67, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (294, 28, 14, 42.59, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (295, 27, 14, 40.92, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (296, 26, 14, 8.93, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (297, 31, 7, 3.62, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (298, 30, 7, 27.75, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (299, 29, 7, 28.11, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (300, 28, 7, 34.55, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (301, 27, 7, 32.85, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (302, 26, 7, 7.39, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (303, 20, 11, 6.38, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (304, 21, 11, 36.72, '2026-03-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (305, 22, 11, 30.26, '2026-04-14', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (306, 23, 11, 26.44, '2026-03-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (307, 24, 11, 26.84, '2026-04-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (308, 25, 11, 3.86, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (309, 20, 10, 6.64, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (310, 21, 10, 36.31, '2026-03-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (311, 22, 10, 35.51, '2026-04-14', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (312, 23, 10, 29.64, '2026-03-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (313, 24, 10, 31.72, '2026-04-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (314, 25, 10, 4.15, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (315, 20, 6, 8.51, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (316, 21, 6, 32.16, '2026-03-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (317, 22, 6, 41.98, '2026-04-14', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (318, 23, 6, 34.10, '2026-03-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (319, 24, 6, 31.36, '2026-04-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (320, 20, 9, 6.57, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (321, 25, 6, 3.75, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (322, 25, 13, 2.31, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (323, 24, 13, 18.98, '2026-04-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (324, 23, 13, 16.42, '2026-03-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (325, 22, 13, 20.94, '2026-04-14', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (326, 21, 13, 20.77, '2026-03-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (327, 25, 14, 4.36, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (328, 24, 14, 28.90, '2026-04-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (329, 23, 14, 34.00, '2026-03-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (330, 22, 14, 40.21, '2026-04-14', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (331, 21, 14, 37.56, '2026-03-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (332, 20, 14, 9.75, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (333, 20, 13, 3.60, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (334, 21, 9, 32.56, '2026-03-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (335, 22, 9, 31.26, '2026-04-14', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (336, 23, 9, 25.18, '2026-03-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (337, 24, 9, 30.80, '2026-04-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (338, 25, 9, 3.64, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (339, 25, 7, 3.39, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (340, 24, 7, 27.15, '2026-04-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (341, 23, 7, 29.97, '2026-03-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (342, 22, 7, 33.77, '2026-04-14', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (343, 21, 7, 29.15, '2026-03-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (344, 20, 7, 6.49, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (345, 25, 12, 4.02, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (346, 25, 8, 4.17, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (347, 24, 8, 40.00, '2026-04-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (348, 23, 8, 31.36, '2026-03-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (349, 22, 8, 40.97, '2026-04-14', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (350, 21, 8, 38.18, '2026-03-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (351, 21, 15, 37.06, '2026-03-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (352, 22, 15, 36.58, '2026-04-14', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (353, 23, 15, 26.25, '2026-03-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (354, 24, 15, 31.54, '2026-04-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (355, 25, 15, 4.37, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (356, 20, 15, 8.71, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (357, 20, 8, 8.58, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (358, 20, 12, 9.47, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (359, 21, 12, 41.11, '2026-03-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (360, 22, 12, 44.09, '2026-04-14', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (361, 23, 12, 40.00, '2026-03-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (362, 24, 12, 32.22, '2026-04-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (363, 19, 7, 4.07, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (364, 14, 9, 6.95, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (365, 15, 9, 27.33, '2026-03-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (366, 16, 9, 26.91, '2026-04-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (367, 17, 9, 27.36, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (368, 18, 9, 27.30, '2026-04-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (369, 19, 9, 3.25, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (370, 14, 10, 6.93, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (371, 15, 10, 30.41, '2026-03-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (372, 16, 10, 39.00, '2026-04-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (373, 17, 10, 33.94, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (374, 18, 10, 28.04, '2026-04-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (375, 19, 10, 4.14, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (376, 18, 7, 25.65, '2026-04-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (377, 17, 7, 26.49, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (378, 16, 7, 29.25, '2026-04-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (379, 15, 7, 30.52, '2026-03-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (380, 14, 7, 7.90, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (381, 14, 11, 6.23, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (382, 15, 11, 35.90, '2026-03-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (383, 16, 11, 35.72, '2026-04-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (384, 17, 11, 31.31, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (385, 18, 11, 26.59, '2026-04-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (386, 19, 11, 4.03, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (387, 14, 12, 9.98, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (388, 15, 12, 41.13, '2026-03-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (389, 16, 12, 37.02, '2026-04-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (390, 17, 12, 30.56, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (391, 18, 12, 32.67, '2026-04-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (392, 19, 12, 4.31, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (393, 14, 15, 7.96, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (394, 15, 15, 32.91, '2026-03-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (395, 16, 15, 39.18, '2026-04-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (396, 17, 15, 27.53, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (397, 18, 15, 34.53, '2026-04-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (398, 19, 15, 3.50, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (399, 14, 13, 3.61, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (400, 15, 13, 17.07, '2026-03-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (401, 16, 13, 18.93, '2026-04-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (402, 17, 13, 17.32, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (403, 18, 13, 14.53, '2026-04-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (404, 19, 13, 1.96, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (405, 19, 6, 3.69, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (406, 18, 6, 37.62, '2026-04-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (407, 17, 6, 33.57, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (408, 16, 6, 36.48, '2026-04-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (409, 15, 6, 32.60, '2026-03-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (410, 14, 6, 8.86, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (411, 14, 14, 9.74, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (412, 15, 14, 43.66, '2026-03-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (413, 16, 14, 36.99, '2026-04-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (414, 17, 14, 38.40, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (415, 18, 14, 33.94, '2026-04-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (416, 19, 14, 4.68, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (417, 14, 8, 8.77, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (418, 15, 8, 44.45, '2026-03-21', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (419, 16, 8, 41.76, '2026-04-17', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (420, 17, 8, 40.00, '2026-03-28', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (421, 18, 8, 36.77, '2026-04-25', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (422, 19, 8, 4.78, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (423, 9, 15, 32.88, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (424, 10, 15, 30.53, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (425, 11, 15, 27.32, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (426, 12, 15, 27.95, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (427, 13, 15, 4.06, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (428, 11, 13, 18.81, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (429, 13, 10, 4.05, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (430, 12, 10, 31.66, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (431, 11, 10, 31.98, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (432, 10, 10, 34.19, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (433, 9, 10, 37.69, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (434, 8, 10, 8.27, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (435, 8, 7, 6.38, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (436, 9, 7, 33.56, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (437, 10, 7, 37.20, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (438, 11, 7, 34.21, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (439, 12, 7, 29.77, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (440, 13, 7, 3.55, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (441, 12, 13, 15.46, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (442, 13, 13, 1.81, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (443, 9, 13, 16.58, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (444, 10, 13, 16.68, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (445, 13, 12, 4.28, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (446, 13, 11, 4.10, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (447, 12, 11, 24.68, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (448, 11, 11, 27.67, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (449, 10, 11, 31.70, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (450, 9, 11, 30.74, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (451, 8, 11, 6.18, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (452, 12, 12, 34.10, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (453, 8, 8, 8.49, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (454, 9, 8, 39.92, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (455, 10, 8, 41.97, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (456, 11, 8, 36.05, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (457, 12, 8, 40.00, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (458, 13, 8, 4.98, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (459, 8, 6, 8.24, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (460, 9, 6, 38.34, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (461, 10, 6, 38.22, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (462, 11, 6, 31.49, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (463, 12, 6, 28.91, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (464, 13, 6, 4.11, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (465, 11, 12, 37.12, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (466, 10, 12, 37.50, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (467, 9, 12, 44.67, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (468, 8, 12, 9.77, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (469, 8, 15, 7.16, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (470, 13, 9, 3.07, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (471, 12, 9, 24.28, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (472, 11, 9, 30.30, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (473, 10, 9, 34.53, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (474, 9, 9, 33.57, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (475, 8, 9, 7.72, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (476, 8, 14, 7.85, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (477, 9, 14, 38.57, '2026-03-19', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (478, 10, 14, 39.10, '2026-04-16', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (479, 11, 14, 34.38, '2026-03-26', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (480, 12, 14, 29.71, '2026-04-23', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (481, 13, 14, 4.46, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (482, 8, 13, 4.10, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (483, 7, 8, 4.90, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (484, 2, 13, 4.44, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (485, 3, 13, 20.18, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (486, 4, 13, 20.47, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (487, 5, 13, 16.75, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (488, 6, 13, 17.43, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (489, 7, 13, 2.08, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (490, 7, 9, 3.78, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (491, 6, 9, 27.73, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (492, 5, 9, 28.80, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (493, 4, 9, 31.10, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (494, 3, 9, 34.52, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (495, 2, 9, 6.62, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (496, 7, 11, 4.01, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (497, 6, 11, 32.31, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (498, 5, 11, 30.60, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (499, 4, 11, 31.87, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (500, 3, 11, 34.88, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (501, 2, 11, 7.84, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (502, 7, 10, 3.43, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (503, 6, 10, 28.84, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (504, 5, 10, 27.61, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (505, 4, 10, 32.52, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (506, 3, 10, 39.94, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (507, 2, 10, 7.74, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (508, 2, 14, 8.24, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (509, 3, 14, 42.76, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (510, 4, 14, 35.09, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (511, 5, 14, 36.71, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (512, 6, 14, 30.52, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (513, 7, 14, 4.53, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (514, 2, 7, 6.44, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (515, 3, 7, 33.63, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (516, 4, 7, 29.12, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (517, 5, 7, 27.16, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (518, 6, 7, 27.97, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (519, 7, 7, 4.08, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (520, 2, 15, 8.30, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (521, 3, 15, 38.09, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (522, 4, 15, 32.44, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (523, 5, 15, 31.21, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (524, 6, 15, 27.35, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (525, 7, 15, 4.01, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (526, 2, 6, 8.21, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (527, 3, 6, 35.47, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (528, 4, 6, 32.15, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (529, 5, 6, 36.47, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (530, 6, 6, 32.15, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (531, 7, 6, 3.81, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (532, 7, 12, 4.26, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (533, 6, 12, 33.19, '2026-04-24', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (534, 5, 12, 36.51, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (535, 4, 12, 38.74, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (536, 3, 12, 45.00, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (537, 2, 12, 10.00, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (538, 2, 8, 9.69, '2026-04-30', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (539, 3, 8, 45.00, '2026-03-20', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (540, 4, 8, 45.00, '2026-04-15', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (541, 5, 8, 32.03, '2026-03-27', NULL);
INSERT INTO public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) VALUES (542, 6, 8, 39.68, '2026-04-24', NULL);
INSERT INTO public.campo_saber (id_campo, nombre_campo, orden_visualizacion, descripcion) VALUES (1, 'Comunidad y Sociedad', 1, 'Lenguajes, ciencias sociales y expresiones culturales');
INSERT INTO public.campo_saber (id_campo, nombre_campo, orden_visualizacion, descripcion) VALUES (2, 'Ciencia Tecnologia y Produccion', 2, 'Matematicas, tecnica y tecnologia');
INSERT INTO public.campo_saber (id_campo, nombre_campo, orden_visualizacion, descripcion) VALUES (3, 'Vida Tierra Territorio', 3, 'Ciencias naturales y cuidado del entorno');
INSERT INTO public.campo_saber (id_campo, nombre_campo, orden_visualizacion, descripcion) VALUES (4, 'Cosmos y Pensamiento', 4, 'Valores, espiritualidad y convivencia');
INSERT INTO public.campo_saber (id_campo, nombre_campo, orden_visualizacion, descripcion) VALUES (7, 'Ciencia Tecnología y Producción', 5, NULL);
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (1, 5, 'COMP-2026-00001', '/recibos/COMP-2026-00001.pdf', '2026-02-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (2, 8, 'COMP-2026-00002', '/recibos/COMP-2026-00002.pdf', '2026-02-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (3, 11, 'COMP-2026-00003', '/recibos/COMP-2026-00003.pdf', '2026-02-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (4, 13, 'COMP-2026-00004', '/recibos/COMP-2026-00004.pdf', '2026-02-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (5, 16, 'COMP-2026-00005', '/recibos/COMP-2026-00005.pdf', '2026-02-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (6, 19, 'COMP-2026-00006', '/recibos/COMP-2026-00006.pdf', '2026-02-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (7, 22, 'COMP-2026-00007', '/recibos/COMP-2026-00007.pdf', '2026-02-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (8, 24, 'COMP-2026-00008', '/recibos/COMP-2026-00008.pdf', '2026-02-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (9, 27, 'COMP-2026-00009', '/recibos/COMP-2026-00009.pdf', '2026-02-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (10, 30, 'COMP-2026-00010', '/recibos/COMP-2026-00010.pdf', '2026-02-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (11, 4, 'COMP-2026-00011', '/recibos/COMP-2026-00011.pdf', '2026-03-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (12, 7, 'COMP-2026-00012', '/recibos/COMP-2026-00012.pdf', '2026-03-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (13, 10, 'COMP-2026-00013', '/recibos/COMP-2026-00013.pdf', '2026-03-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (14, 15, 'COMP-2026-00014', '/recibos/COMP-2026-00014.pdf', '2026-03-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (15, 18, 'COMP-2026-00015', '/recibos/COMP-2026-00015.pdf', '2026-03-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (16, 21, 'COMP-2026-00016', '/recibos/COMP-2026-00016.pdf', '2026-03-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (17, 26, 'COMP-2026-00017', '/recibos/COMP-2026-00017.pdf', '2026-03-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (18, 29, 'COMP-2026-00018', '/recibos/COMP-2026-00018.pdf', '2026-03-11 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (19, 3, 'COMP-2026-00019', '/recibos/COMP-2026-00019.pdf', '2026-01-25 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (20, 6, 'COMP-2026-00020', '/recibos/COMP-2026-00020.pdf', '2026-01-25 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (21, 9, 'COMP-2026-00021', '/recibos/COMP-2026-00021.pdf', '2026-01-25 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (22, 12, 'COMP-2026-00022', '/recibos/COMP-2026-00022.pdf', '2026-01-25 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (23, 14, 'COMP-2026-00023', '/recibos/COMP-2026-00023.pdf', '2026-01-25 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (24, 17, 'COMP-2026-00024', '/recibos/COMP-2026-00024.pdf', '2026-01-25 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (25, 20, 'COMP-2026-00025', '/recibos/COMP-2026-00025.pdf', '2026-01-25 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (26, 23, 'COMP-2026-00026', '/recibos/COMP-2026-00026.pdf', '2026-01-25 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (27, 25, 'COMP-2026-00027', '/recibos/COMP-2026-00027.pdf', '2026-01-25 00:01:00');
INSERT INTO public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) VALUES (28, 28, 'COMP-2026-00028', '/recibos/COMP-2026-00028.pdf', '2026-01-25 00:01:00');
INSERT INTO public.concepto_pago (id_concepto, nombre_concepto, descripcion) VALUES (1, 'Inscripcion', 'Pago anual de inscripcion');
INSERT INTO public.concepto_pago (id_concepto, nombre_concepto, descripcion) VALUES (4, 'Uniforme', 'Pago por uniforme institucional');
INSERT INTO public.concepto_pago (id_concepto, nombre_concepto, descripcion) VALUES (2, 'Mensualidad', 'Pago mensual');
INSERT INTO public.concepto_pago (id_concepto, nombre_concepto, descripcion) VALUES (10, 'Matrícula', 'Inscripción anual');
INSERT INTO public.concepto_pago (id_concepto, nombre_concepto, descripcion) VALUES (3, 'Material escolar', 'Paquete de materiales');
INSERT INTO public.concepto_pago (id_concepto, nombre_concepto, descripcion) VALUES (12, 'Seguro escolar', 'Seguro contra accidentes');
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (1, 1, 'A', 1, 1, 1, 'Tarde', true);
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (2, 3, 'A', 2, 1, 1, 'Mañana', true);
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (3, 2, 'A', 3, 1, 2, 'Mañana', true);
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (4, 15, 'A', 21, 1, 16, 'Mañana', true);
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (5, 16, 'A', 20, 1, 13, 'Mañana', true);
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (6, 17, 'A', 19, 1, 12, 'Mañana', true);
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (7, 18, 'A', 18, 1, 16, 'Mañana', true);
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (8, 19, 'A', 17, 1, 13, 'Mañana', true);
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (9, 20, 'A', 16, 1, 12, 'Mañana', true);
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (10, 14, 'A', 15, 1, 18, 'Mañana', true);
INSERT INTO public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) VALUES (11, 13, 'A', 14, 1, 17, 'Mañana', true);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (1, 1, 1, 1);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (2, 1, 2, 2);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (3, 1, 3, 1);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (4, 1, 4, 1);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (5, 2, 1, 1);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (6, 2, 2, 2);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (7, 2, 3, 1);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (8, 2, 4, 1);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (9, 3, 1, 1);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (10, 3, 2, 2);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (11, 3, 3, 1);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (12, 3, 4, 1);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (13, 6, 5, 14);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (14, 6, 6, 15);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (15, 6, 7, 12);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (16, 6, 8, 13);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (17, 6, 9, 12);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (18, 9, 5, 14);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (19, 9, 6, 15);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (20, 9, 7, 12);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (21, 9, 8, 13);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (22, 9, 9, 12);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (23, 6, 10, 16);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (24, 6, 11, 16);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (25, 9, 10, 16);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (26, 9, 11, 16);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (27, 6, 3, 13);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (28, 9, 3, 13);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (29, 6, 12, 12);
INSERT INTO public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) VALUES (30, 9, 12, 12);
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (1, 4, 1, 1, 150.00, 'Febrero', 'mora', '2026-05-06 13:36:59.335787');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (2, 5, 1, 2, 180.00, 'Mayo', 'pendiente', '2026-05-06 13:36:59.335787');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (4, 2, 1, 2, 220.00, 'Mayo', 'pendiente', '2026-05-06 13:36:59.335787');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (5, 1, 1, 2, 220.00, 'Mayo', 'pendiente', '2026-05-06 13:36:59.335787');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (3, 3, 1, 2, 220.00, 'Abril', 'pagado', '2026-05-06 13:36:59.335787');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (19, 9, 1, 2, 150.00, 'marzo', 'mora', '2026-03-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (23, 13, 1, 2, 150.00, 'marzo', 'mora', '2026-03-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (26, 6, 1, 10, 80.00, 'febrero', 'pagado', '2026-01-15 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (16, 6, 1, 2, 150.00, 'marzo', 'pagado', '2026-03-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (6, 6, 1, 2, 150.00, 'febrero', 'pagado', '2026-02-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (27, 7, 1, 10, 80.00, 'febrero', 'pagado', '2026-01-15 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (17, 7, 1, 2, 150.00, 'marzo', 'pagado', '2026-03-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (7, 7, 1, 2, 150.00, 'febrero', 'pagado', '2026-02-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (28, 8, 1, 10, 80.00, 'febrero', 'pagado', '2026-01-15 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (18, 8, 1, 2, 150.00, 'marzo', 'pagado', '2026-03-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (8, 8, 1, 2, 150.00, 'febrero', 'pagado', '2026-02-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (29, 9, 1, 10, 80.00, 'febrero', 'pagado', '2026-01-15 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (9, 9, 1, 2, 150.00, 'febrero', 'pagado', '2026-02-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (30, 10, 1, 10, 80.00, 'febrero', 'pagado', '2026-01-15 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (20, 10, 1, 2, 150.00, 'marzo', 'pagado', '2026-03-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (10, 10, 1, 2, 150.00, 'febrero', 'pagado', '2026-02-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (31, 11, 1, 10, 80.00, 'febrero', 'pagado', '2026-01-15 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (21, 11, 1, 2, 150.00, 'marzo', 'pagado', '2026-03-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (11, 11, 1, 2, 150.00, 'febrero', 'pagado', '2026-02-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (32, 12, 1, 10, 80.00, 'febrero', 'pagado', '2026-01-15 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (22, 12, 1, 2, 150.00, 'marzo', 'pagado', '2026-03-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (12, 12, 1, 2, 150.00, 'febrero', 'pagado', '2026-02-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (33, 13, 1, 10, 80.00, 'febrero', 'pagado', '2026-01-15 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (13, 13, 1, 2, 150.00, 'febrero', 'pagado', '2026-02-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (34, 14, 1, 10, 80.00, 'febrero', 'pagado', '2026-01-15 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (24, 14, 1, 2, 150.00, 'marzo', 'pagado', '2026-03-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (14, 14, 1, 2, 150.00, 'febrero', 'pagado', '2026-02-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (35, 15, 1, 10, 80.00, 'febrero', 'pagado', '2026-01-15 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (25, 15, 1, 2, 150.00, 'marzo', 'pagado', '2026-03-01 00:00:00');
INSERT INTO public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) VALUES (15, 15, 1, 2, 150.00, 'febrero', 'pagado', '2026-02-01 00:00:00');
INSERT INTO public.dimension_evaluacion (id_dimension_eval, nombre_dimension, puntaje_maximo, id_gestion) VALUES (1, 'Ser', 10.00, 1);
INSERT INTO public.dimension_evaluacion (id_dimension_eval, nombre_dimension, puntaje_maximo, id_gestion) VALUES (2, 'Saber', 45.00, 1);
INSERT INTO public.dimension_evaluacion (id_dimension_eval, nombre_dimension, puntaje_maximo, id_gestion) VALUES (3, 'Hacer', 40.00, 1);
INSERT INTO public.dimension_evaluacion (id_dimension_eval, nombre_dimension, puntaje_maximo, id_gestion) VALUES (4, 'Autoevaluacion', 5.00, 1);
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (1, 1, 1, 4, '2026-05-04 12:20:00', 'Entrega demo autorizada');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (2, 6, 7, 21, '2026-03-23 11:30:00', 'Madre, CI verificado');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (3, 7, 8, 21, '2026-03-23 11:32:00', 'Padre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (4, 8, 9, 21, '2026-03-23 11:35:00', 'Madre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (5, 9, 11, 21, '2026-03-23 11:33:00', 'Madre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (6, 10, 12, 21, '2026-03-23 11:40:00', 'Padre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (7, 11, 13, 21, '2026-03-23 11:38:00', 'Madre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (8, 12, 15, 21, '2026-03-23 11:36:00', 'Madre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (9, 13, 16, 21, '2026-03-23 11:42:00', 'Padre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (10, 14, 18, 21, '2026-03-23 11:45:00', 'Madre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (11, 15, 20, 21, '2026-03-23 11:48:00', 'Madre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (12, 6, 6, 21, '2026-03-24 11:30:00', 'Padre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (13, 8, 9, 21, '2026-03-24 11:35:00', 'Madre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (14, 12, 14, 21, '2026-03-24 11:36:00', 'Padre');
INSERT INTO public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) VALUES (15, 7, 21, 21, '2026-03-25 11:32:00', 'Tío NO autorizado - caso especial [ALERTA: Tutor no autorizado]');
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (1, 'Sofia', 'Mamani', 'EST-2001', '2018-04-12', 8, 'Femenino', 'activo', '2026-05-06 13:36:59.335787', 'Demo: estudiante de primero A');
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (2, 'Lucas', 'Flores', 'EST-2002', '2018-09-03', 7, 'Masculino', 'activo', '2026-05-06 13:36:59.335787', 'Demo: estudiante de primero A');
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (3, 'Camila', 'Vargas', 'EST-2003', '2017-02-22', 9, 'Femenino', 'activo', '2026-05-06 13:36:59.335787', 'Demo: estudiante de segundo A');
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (4, 'Diego', 'Choque', 'EST-2004', '2017-07-18', 8, 'Masculino', 'activo', '2026-05-06 13:36:59.335787', 'Demo: estudiante de segundo A');
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (5, 'Valentina', 'Cruz', 'EST-2005', '2020-01-15', 6, 'Femenino', 'activo', '2026-05-06 13:36:59.335787', 'Demo: estudiante de kinder A');
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (6, 'Uriel', 'Alvarado Cuellar', '13456701', '2019-03-15', 7, 'Masculino', 'activo', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (7, 'Victoria', 'Andreu Torrez', '13456702', '2019-06-22', 6, 'Femenino', 'activo', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (8, 'Louane Anthonella', 'Azenas Lopez', '13456703', '2019-01-10', 7, 'Femenino', 'activo', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (9, 'Jhuliane', 'Azurduy Cuellar', '13456704', '2019-08-05', 6, 'Femenino', 'activo', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (10, 'Matias', 'Castro Rojas', '13456705', '2019-04-18', 7, 'Masculino', 'activo', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (11, 'Felix Jassiel', 'Contreras Andrade', '13456706', '2019-11-30', 6, 'Masculino', 'activo', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (12, 'Isabel Valentina', 'Crespo Mallcu', '13456707', '2019-07-12', 6, 'Femenino', 'activo', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (13, 'Victoria', 'Cuellar Velazquez', '13456708', '2019-02-28', 7, 'Femenino', 'activo', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (14, 'Dulce Kamila', 'Espinosa Fuentes', '13456709', '2019-09-14', 6, 'Femenino', 'activo', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) VALUES (15, 'Roshely Celeste', 'Farell Moya', '13456710', '2019-05-08', 6, 'Femenino', 'activo', '2026-05-06 21:52:46.892993', NULL);
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (1, 'GET /api/auth/me', 'Validar sesion', 1, 1, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (31, 'GET /api/estudiantes/*', 'Consultar estudiantes', 11, 6, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (34, 'GET /api/expedientes/:id', 'Consultar expediente', 14, 7, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (2, 'GET /api/roles', 'Listar roles', 3, 2, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (3, 'POST /api/roles', 'Crear roles', 3, 2, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (4, 'DELETE /api/roles/:id', 'Eliminar roles', 3, 2, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (5, 'GET /api/users', 'Listar usuarios', 2, 2, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (6, 'POST /api/users', 'Crear usuarios', 2, 2, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (7, 'PUT /api/users/:id', 'Actualizar usuarios', 2, 2, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (8, 'DELETE /api/users/:id', 'Eliminar usuarios', 2, 2, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (9, 'GET /api/bitacora', 'Consultar bitacora', 4, 3, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (10, 'GET /api/bitacora/filtros', 'Consultar filtros de bitacora', 4, 3, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (11, 'POST /api/auth/login', 'Registrar inicio de sesion', 4, 3, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (12, 'POST /api/auth/logout', 'Registrar cierre de sesion', 4, 3, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (13, 'GET /api/seguridad/modulos-funcionalidades', 'Consultar modulos y funcionalidades', 3, 3, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (14, 'GET /api/estructura/*', 'Consultar estructura educativa', 5, 4, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (15, 'POST /api/estructura/*', 'Crear estructura educativa', 5, 4, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (16, 'PUT /api/estructura/*', 'Actualizar estructura educativa', 5, 4, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (17, 'GET /api/horarios/*', 'Consultar horarios', 9, 5, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (18, 'POST /api/horarios', 'Crear bloques de horario', 9, 5, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (19, 'PUT /api/horarios/:id', 'Editar bloques de horario', 9, 5, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (67, 'PUT /api/horarios/curso/:id_curso/publicar', 'Publicar horario', 9, 5, true, '2026-05-06 13:36:59.257473');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (20, 'GET /api/materia-asig/*', 'Consultar asignaciones de materias', 8, 5, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (21, 'POST /api/materia-asig/*', 'Asignar materias a cursos', 8, 5, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (22, 'GET /api/materias/*', 'Consultar materias', 7, 5, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (23, 'POST /api/materias/*', 'Crear materias', 7, 5, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (24, 'GET /api/curso/*', 'Consultar cursos', 6, 5, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (25, 'POST /api/curso/*', 'Crear cursos', 6, 5, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (26, 'PUT /api/curso/*', 'Actualizar cursos', 6, 5, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (29, 'GET /api/tutores/*', 'Consultar tutores', 12, 6, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (30, 'POST /api/tutores', 'Registrar tutores', 12, 6, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (27, 'POST /api/inscripciones', 'Inscribir estudiantes', 13, 6, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (28, 'PUT /api/inscripciones/*', 'Retirar o trasladar estudiantes', 13, 6, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (79, 'GET /api/estudiantes/*', 'Consultar estudiantes', 10, 6, true, '2026-05-06 13:36:59.257473');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (32, 'POST /api/estudiantes', 'Registrar estudiantes', 10, 6, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (33, 'PUT /api/estudiantes/:id', 'Actualizar estudiantes', 10, 6, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (35, 'GET /api/asistencias/cursos', 'Listar cursos para asistencia', 16, 8, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (36, 'GET /api/asistencias/curso/:id_curso', 'Consultar asistencia por curso y fecha', 16, 8, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (37, 'POST /api/asistencias/curso/:id_curso', 'Registrar asistencia por curso y fecha', 15, 8, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (38, 'GET /api/pagos/conceptos', 'Listar conceptos de pago', 20, 10, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (39, 'GET /api/pagos/deudas', 'Listar deudas y pagos', 20, 10, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (40, 'POST /api/pagos/conceptos', 'Crear conceptos de pago', 19, 10, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (41, 'POST /api/pagos/deudas', 'Generar deudas', 19, 10, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (42, 'POST /api/pagos', 'Registrar pagos', 19, 10, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (43, 'PUT /api/pagos/:id/estado', 'Validar o rechazar pagos', 19, 10, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (44, 'GET /api/inventario/materiales', 'Listar materiales', 22, 11, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (45, 'GET /api/inventario/movimientos', 'Listar movimientos de inventario', 22, 11, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (46, 'POST /api/inventario/materiales', 'Crear materiales', 21, 11, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (47, 'PUT /api/inventario/materiales/:id', 'Actualizar materiales', 21, 11, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (48, 'POST /api/inventario/movimientos', 'Registrar movimientos de inventario', 21, 11, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) VALUES (82, 'GET /api/expedientes/:id_estudiante', 'Consultar expediente digital', 14, 7, true, '2026-05-06 13:36:59.257473');
INSERT INTO public.gestion_academica (id_gestion, anio, fecha_inicio, fecha_fin, estado) VALUES (2, 2025, '2025-02-03', '2025-11-28', 'cerrada');
INSERT INTO public.gestion_academica (id_gestion, anio, fecha_inicio, fecha_fin, estado) VALUES (1, 2026, '2026-02-02', '2026-11-27', 'activa');
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (1, 'Kinder', 1);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (2, '2do Primaria', 2);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (3, '1ro Primaria', 2);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (4, '1ro Secundaria', 3);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (13, 'Pre-Kínder', 7);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (14, 'Kínder', 8);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (15, 'Sexto', 2);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (16, 'Quinto', 2);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (17, 'Cuarto', 2);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (18, 'Tercero', 2);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (19, 'Segundo', 2);
INSERT INTO public.grado (id_grado, nombre_grado, id_nivel) VALUES (20, 'Primero', 2);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (1, 1, 1, 'martes', '14:00:00', '14:45:00', 'Cuentos y canciones', true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (2, 1, 4, 'lunes', '14:00:00', '14:45:00', 'Convivencia', true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (3, 2, 1, 'lunes', '08:00:00', '08:45:00', 'Lectura guiada', true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (4, 2, 2, 'lunes', '08:45:00', '09:30:00', 'Numeros y conteo', true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (5, 2, 3, 'martes', '08:00:00', '08:45:00', 'El entorno', true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (6, 3, 1, 'martes', '08:45:00', '09:30:00', 'Comprension lectora', true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (7, 3, 2, 'lunes', '08:00:00', '08:45:00', 'Operaciones basicas', true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (8, 9, 11, 'lunes', '08:00:00', '08:45:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (9, 9, 9, 'lunes', '08:45:00', '09:30:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (10, 9, 3, 'lunes', '10:00:00', '10:45:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (11, 9, 7, 'lunes', '10:45:00', '11:30:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (12, 9, 9, 'martes', '08:00:00', '08:45:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (13, 9, 11, 'martes', '08:45:00', '09:30:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (14, 9, 8, 'martes', '10:00:00', '10:45:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (15, 9, 12, 'martes', '10:45:00', '11:30:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (16, 9, 11, 'miercoles', '08:00:00', '08:45:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (17, 9, 6, 'miercoles', '08:45:00', '09:30:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (18, 9, 9, 'miercoles', '10:00:00', '10:45:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (19, 9, 10, 'miercoles', '10:45:00', '11:30:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (20, 9, 9, 'jueves', '08:00:00', '08:45:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (21, 9, 11, 'jueves', '08:45:00', '09:30:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (22, 9, 5, 'jueves', '10:00:00', '10:45:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (23, 9, 3, 'jueves', '10:45:00', '11:30:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (24, 9, 8, 'viernes', '08:00:00', '08:45:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (25, 9, 11, 'viernes', '08:45:00', '09:30:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (26, 9, 10, 'viernes', '10:00:00', '10:45:00', NULL, true);
INSERT INTO public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) VALUES (27, 9, 6, 'viernes', '10:45:00', '11:30:00', NULL, true);
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (1, 5, 1, '2026-02-05', 'inscrito', 'Inscripcion demo 2026');
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (2, 1, 2, '2026-02-05', 'inscrito', 'Inscripcion demo 2026');
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (3, 2, 2, '2026-02-05', 'inscrito', 'Inscripcion demo 2026');
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (4, 3, 3, '2026-02-05', 'inscrito', 'Inscripcion demo 2026');
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (5, 4, 3, '2026-02-05', 'inscrito', 'Inscripcion demo 2026');
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (6, 6, 9, '2026-01-20', 'inscrito', NULL);
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (7, 7, 9, '2026-01-21', 'inscrito', NULL);
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (8, 8, 9, '2026-01-22', 'inscrito', NULL);
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (9, 9, 9, '2026-01-22', 'inscrito', NULL);
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (10, 10, 9, '2026-01-23', 'inscrito', NULL);
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (11, 11, 9, '2026-01-23', 'inscrito', NULL);
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (12, 12, 9, '2026-01-24', 'inscrito', NULL);
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (13, 13, 9, '2026-01-24', 'inscrito', NULL);
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (14, 14, 9, '2026-01-25', 'inscrito', NULL);
INSERT INTO public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) VALUES (15, 15, 9, '2026-01-25', 'inscrito', NULL);
INSERT INTO public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) VALUES (1, 15, 9, 1, 1, 'entregada', 16, '2026-05-10 16:00:00', '2026-05-12 09:30:00', '/libretas/2026/T1/1A_est_010.pdf');
INSERT INTO public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) VALUES (2, 14, 9, 1, 1, 'entregada', 16, '2026-05-10 16:00:00', '2026-05-12 09:30:00', '/libretas/2026/T1/1A_est_009.pdf');
INSERT INTO public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) VALUES (3, 13, 9, 1, 1, 'entregada', 16, '2026-05-10 16:00:00', '2026-05-12 09:30:00', '/libretas/2026/T1/1A_est_008.pdf');
INSERT INTO public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) VALUES (4, 12, 9, 1, 1, 'entregada', 16, '2026-05-10 16:00:00', '2026-05-12 09:30:00', '/libretas/2026/T1/1A_est_007.pdf');
INSERT INTO public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) VALUES (5, 11, 9, 1, 1, 'entregada', 16, '2026-05-10 16:00:00', '2026-05-12 09:30:00', '/libretas/2026/T1/1A_est_006.pdf');
INSERT INTO public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) VALUES (6, 10, 9, 1, 1, 'entregada', 16, '2026-05-10 16:00:00', '2026-05-12 09:30:00', '/libretas/2026/T1/1A_est_005.pdf');
INSERT INTO public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) VALUES (7, 9, 9, 1, 1, 'entregada', 16, '2026-05-10 16:00:00', '2026-05-12 09:30:00', '/libretas/2026/T1/1A_est_004.pdf');
INSERT INTO public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) VALUES (8, 8, 9, 1, 1, 'entregada', 16, '2026-05-10 16:00:00', '2026-05-12 09:30:00', '/libretas/2026/T1/1A_est_003.pdf');
INSERT INTO public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) VALUES (9, 7, 9, 1, 1, 'entregada', 16, '2026-05-10 16:00:00', '2026-05-12 09:30:00', '/libretas/2026/T1/1A_est_002.pdf');
INSERT INTO public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) VALUES (10, 6, 9, 1, 1, 'entregada', 16, '2026-05-10 16:00:00', '2026-05-12 09:30:00', '/libretas/2026/T1/1A_est_001.pdf');
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (1, 'Lenguaje', 'Lectura, escritura y comunicacion', 1, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (2, 'Matematicas', 'Numeros, operaciones y resolucion de problemas', 2, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (3, 'Ciencias Naturales', 'Observacion del entorno y vida saludable', 3, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (4, 'Valores', 'Convivencia, responsabilidad y respeto', 4, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (5, 'Educación Musical', 'Expresión musical e instrumentos', 1, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (6, 'Educación Física y Deportes', 'Desarrollo físico y deportes', 1, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (7, 'Artes Plásticas y Visuales', 'Expresión artística y manualidades', 1, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (8, 'Ciencias Sociales', 'Historia, geografía y educación cívica', 1, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (9, 'Lenguaje y Comunicación', 'Competencias comunicativas en castellano', 1, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (10, 'Técnica Tecnológica', 'Herramientas tecnológicas y productivas', 7, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (11, 'Matemática', 'Pensamiento lógico-matemático', 7, true, true);
INSERT INTO public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES (12, 'Valores Espiritualidad y Religiones', 'Valores éticos y espiritualidad intercultural', 4, true, true);
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (2, 'Lapices HB', 'Lapices de grafito para aula', 'Material escolar', 250, 100, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (3, 'Tizas blancas', 'Caja de tizas blancas', 'Material escolar', 60, 20, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (4, 'Sillas escolares', 'Mobiliario para aulas', 'Mobiliario', 35, 20, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (5, 'Mesas escolares', 'Mobiliario para aulas', 'Mobiliario', 20, 20, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (1, 'Cuadernos rayados 100 hojas', 'Cuadernos para uso escolar', 'Material escolar', 108, 50, true, '2026-05-06 13:36:59.1814');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (8, 'Marcador de pizarra', 'Marcador borrable azul/negro', 'papelería', 8, 10, true, '2026-05-06 21:52:46.892993');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (9, 'Resma papel carta', '500 hojas bond', 'papelería', 20, 5, true, '2026-05-06 21:52:46.892993');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (11, 'Cuerda para saltar', '3 metros', 'deportes', 15, 5, true, '2026-05-06 21:52:46.892993');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (12, 'Botiquín primeros auxilios', 'Kit completo', 'salud', 2, 2, true, '2026-05-06 21:52:46.892993');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (13, 'Escoba', 'Fibra para limpieza', 'limpieza', 8, 3, true, '2026-05-06 21:52:46.892993');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (14, 'Detergente 1kg', 'Polvo limpieza general', 'limpieza', 10, 3, true, '2026-05-06 21:52:46.892993');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (6, 'Insignia escolar', 'Insignia metálica con logo', 'uniformes', 45, 10, true, '2026-05-06 21:52:46.892993');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (7, 'Tiza blanca (caja)', 'Caja de 100 unidades', 'papelería', 4, 5, true, '2026-05-06 21:52:46.892993');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (10, 'Balón de fútbol', 'N°4 para primaria', 'deportes', 1, 2, true, '2026-05-06 21:52:46.892993');
INSERT INTO public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) VALUES (15, 'Flauta dulce', 'Soprano educación musical', 'instrumentos', 20, 5, true, '2026-05-06 21:52:46.892993');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (1, 'general', 'Acceso general al sistema', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (9, 'evaluaciones', 'Evaluaciones y calificaciones', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (12, 'entregas', 'Entrega segura de estudiantes', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (13, 'comunicacion', 'Avisos y notificaciones', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (14, 'reportes', 'Reportes institucionales', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (2, 'usuarios', 'Gestion de usuarios, roles y permisos', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (3, 'seguridad', 'Auditoria, permisos y bitacora del sistema', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (4, 'estructura', 'Gestion de aulas, niveles y grados', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (5, 'academico', 'Gestion academica: cursos, materias y horarios', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (6, 'estudiantes', 'Gestion de estudiantes, tutores e inscripciones', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (7, 'expedientes', 'Consulta de expedientes digitales', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (8, 'asistencias', 'Control de asistencia estudiantil', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (10, 'pagos', 'Gestion financiera', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) VALUES (11, 'inventario', 'Gestion de inventario', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (1, 1, 'entrada', 120, '2026-05-06 13:36:59.335787', 4, 'Carga demo: cuadernos');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (2, 2, 'entrada', 250, '2026-05-06 13:36:59.335787', 4, 'Carga demo: lapices');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (3, 3, 'entrada', 60, '2026-05-06 13:36:59.335787', 4, 'Carga demo: tizas');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (4, 4, 'entrada', 35, '2026-05-06 13:36:59.335787', 4, 'Carga demo: sillas');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (5, 5, 'entrada', 20, '2026-05-06 13:36:59.335787', 4, 'Carga demo: mesas');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (6, 1, 'salida', 12, '2026-05-06 13:36:59.335787', 4, 'Entrega demo a 1ro A');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (7, 6, 'entrada', 50, '2026-02-01 08:00:00', 22, 'Compra inicio gestión');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (8, 6, 'salida', 5, '2026-02-10 09:00:00', 22, 'Entrega estudiantes nuevos');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (9, 7, 'entrada', 15, '2026-02-01 08:00:00', 22, 'Compra inicio gestión');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (10, 7, 'salida', 11, '2026-03-15 10:00:00', 22, 'Distribución a aulas');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (11, 10, 'entrada', 8, '2026-02-01 08:00:00', 22, 'Compra inicio gestión');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (12, 10, 'salida', 7, '2026-03-01 11:00:00', 22, 'Entrega Ed. Física');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (13, 15, 'entrada', 25, '2026-02-01 08:00:00', 22, 'Compra clase música');
INSERT INTO public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) VALUES (14, 15, 'salida', 5, '2026-03-05 09:00:00', 22, 'Préstamo estudiantes 1ro A');
INSERT INTO public.nivel (id_nivel, nombre_nivel, monto_mensualidad) VALUES (1, 'Inicial', 180.00);
INSERT INTO public.nivel (id_nivel, nombre_nivel, monto_mensualidad) VALUES (3, 'Secundaria', 260.00);
INSERT INTO public.nivel (id_nivel, nombre_nivel, monto_mensualidad) VALUES (7, 'Pre-Kínder', 100.00);
INSERT INTO public.nivel (id_nivel, nombre_nivel, monto_mensualidad) VALUES (8, 'Kínder', 120.00);
INSERT INTO public.nivel (id_nivel, nombre_nivel, monto_mensualidad) VALUES (2, 'Primaria', 150.00);
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (1, 1, 1, 'whatsapp', 'enviado', '2026-05-06 08:02:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (2, 1, 2, 'whatsapp', 'enviado', '2026-05-06 08:02:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (3, 2, 6, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (4, 2, 7, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (5, 2, 8, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (6, 2, 9, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (7, 3, 10, 'whatsapp', 'enviado', '2026-03-20 09:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (8, 2, 10, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (9, 3, 11, 'whatsapp', 'enviado', '2026-03-20 09:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (10, 2, 11, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (11, 2, 12, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (12, 2, 13, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (13, 2, 14, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (14, 2, 15, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (15, 3, 16, 'whatsapp', 'enviado', '2026-03-20 09:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (16, 2, 16, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (17, 2, 17, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (18, 2, 18, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (19, 2, 19, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (20, 2, 20, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) VALUES (21, 2, 21, 'whatsapp', 'enviado', '2026-05-05 10:01:00');
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (1, 3, 3, 220.00, 'efectivo', NULL, 'validado', 4, '2026-05-04 10:15:00', 'Pago demo validado');
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (2, 4, 2, 100.00, 'QR', 'demo/qr-pendiente.png', 'pendiente_validacion', 4, '2026-05-05 09:30:00', 'Pago demo pendiente de validacion');
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (3, 26, 6, 80.00, 'efectivo', NULL, 'validado', 22, '2026-01-25 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (4, 16, 6, 150.00, 'efectivo', NULL, 'validado', 22, '2026-03-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (5, 6, 6, 150.00, 'efectivo', NULL, 'validado', 22, '2026-02-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (6, 27, 7, 80.00, 'transferencia', NULL, 'validado', 22, '2026-01-25 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (7, 17, 7, 150.00, 'transferencia', NULL, 'validado', 22, '2026-03-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (8, 7, 7, 150.00, 'transferencia', NULL, 'validado', 22, '2026-02-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (9, 28, 8, 80.00, 'QR', NULL, 'validado', 22, '2026-01-25 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (10, 18, 8, 150.00, 'QR', NULL, 'validado', 22, '2026-03-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (11, 8, 8, 150.00, 'QR', NULL, 'validado', 22, '2026-02-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (12, 29, 9, 80.00, 'efectivo', NULL, 'validado', 22, '2026-01-25 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (13, 9, 9, 150.00, 'efectivo', NULL, 'validado', 22, '2026-02-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (14, 30, 10, 80.00, 'transferencia', NULL, 'validado', 22, '2026-01-25 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (15, 20, 10, 150.00, 'transferencia', NULL, 'validado', 22, '2026-03-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (16, 10, 10, 150.00, 'transferencia', NULL, 'validado', 22, '2026-02-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (17, 31, 11, 80.00, 'QR', NULL, 'validado', 22, '2026-01-25 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (18, 21, 11, 150.00, 'QR', NULL, 'validado', 22, '2026-03-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (19, 11, 11, 150.00, 'QR', NULL, 'validado', 22, '2026-02-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (20, 32, 12, 80.00, 'efectivo', NULL, 'validado', 22, '2026-01-25 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (21, 22, 12, 150.00, 'efectivo', NULL, 'validado', 22, '2026-03-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (22, 12, 12, 150.00, 'efectivo', NULL, 'validado', 22, '2026-02-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (23, 33, 13, 80.00, 'transferencia', NULL, 'validado', 22, '2026-01-25 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (24, 13, 13, 150.00, 'transferencia', NULL, 'validado', 22, '2026-02-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (25, 34, 14, 80.00, 'QR', NULL, 'validado', 22, '2026-01-25 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (26, 24, 14, 150.00, 'QR', NULL, 'validado', 22, '2026-03-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (27, 14, 14, 150.00, 'QR', NULL, 'validado', 22, '2026-02-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (28, 35, 15, 80.00, 'efectivo', NULL, 'validado', 22, '2026-01-25 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (29, 25, 15, 150.00, 'efectivo', NULL, 'validado', 22, '2026-03-11 00:00:00', NULL);
INSERT INTO public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) VALUES (30, 15, 15, 150.00, 'efectivo', NULL, 'validado', 22, '2026-02-11 00:00:00', NULL);
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (6, 'gestionar_cursos', 'Crear, consultar y actualizar cursos');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (7, 'gestionar_materias', 'Crear, consultar y actualizar materias');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (8, 'asignar_materias', 'Asignar materias y profesores a cursos');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (9, 'gestionar_horarios', 'Crear, editar y publicar horarios');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (12, 'gestionar_tutores', 'Crear, consultar y actualizar tutores');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (14, 'consultar_expedientes', 'Consultar expedientes digitales de estudiantes');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (4, 'ver_bitacora', 'Consultar bitacora de auditoria del sistema');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (1, 'ver_dashboard', 'Ver panel principal');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (2, 'gestionar_usuarios', 'Crear y editar usuarios');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (3, 'gestionar_roles', 'Crear y modificar roles');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (11, 'ver_estudiantes', 'Consultar expedientes');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (10, 'gestionar_estudiantes', 'Registrar estudiantes');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (13, 'gestionar_inscripciones', 'Registrar inscripciones');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (16, 'ver_asistencias', 'Consultar asistencia');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (15, 'registrar_asistencia', 'Tomar asistencia');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (18, 'ver_evaluaciones', 'Consultar calificaciones');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (17, 'gestionar_evaluaciones', 'Crear actividades y notas');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (70, 'aprobar_libretas', 'Aprobar libretas electrónicas');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (20, 'ver_pagos', 'Consultar pagos');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (19, 'gestionar_pagos', 'Registrar pagos');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (22, 'ver_inventario', 'Consultar stock');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (21, 'gestionar_inventario', 'Registrar movimientos');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (25, 'publicar_avisos', 'Crear comunicados');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (24, 'ver_entregas', 'Consultar entregas');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (23, 'registrar_entregas', 'Registrar entregas');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (26, 'ver_reportes', 'Generar reportes');
INSERT INTO public.permiso (id_permiso, nombre_permiso, descripcion) VALUES (5, 'gestionar_estructura', 'Configurar estructura');
INSERT INTO public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) VALUES (1, 2, 'Maria', 'Quiroga', 'PROF-1001', 'Lic. Educacion Primaria', 'Femenino', true, '2026-05-06 13:36:59.335787');
INSERT INTO public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) VALUES (2, 3, 'Carlos', 'Rojas', 'PROF-1002', 'Lic. Matematicas', 'Masculino', true, '2026-05-06 13:36:59.335787');
INSERT INTO public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) VALUES (11, 16, 'Ana María', 'Torrez Salinas', '4523178', 'Lic. en Administración Educativa', 'Femenino', true, '2026-05-06 21:52:46.892993');
INSERT INTO public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) VALUES (12, 21, 'María Elena', 'Quispe Mamani', '6547832', 'Lic. en Educación Primaria', 'Femenino', true, '2026-05-06 21:52:46.892993');
INSERT INTO public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) VALUES (13, 20, 'Juan Carlos', 'Mamani Condori', '5234876', 'Lic. en Ciencias de la Educación', 'Masculino', true, '2026-05-06 21:52:46.892993');
INSERT INTO public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) VALUES (14, 19, 'Carmen Rosa', 'Villca Paco', '7123456', 'Lic. en Educación Musical', 'Femenino', true, '2026-05-06 21:52:46.892993');
INSERT INTO public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) VALUES (15, 18, 'Luis Fernando', 'Choque Ticona', '6098234', 'Lic. en Educación Física', 'Masculino', true, '2026-05-06 21:52:46.892993');
INSERT INTO public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) VALUES (16, 17, 'Rosa', 'Flores Huanca', '8234567', 'Lic. en Matemáticas', 'Femenino', true, '2026-05-06 21:52:46.892993');
INSERT INTO public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) VALUES (17, 24, 'Patricia', 'Mendoza Cruz', '5567890', 'Técnico en Educación Inicial', 'Femenino', true, '2026-05-06 21:52:46.892993');
INSERT INTO public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) VALUES (18, 23, 'Sofía', 'Vargas Limachi', '6678901', 'Técnico en Educación Inicial', 'Femenino', true, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol (id_rol, nombre_rol, descripcion, estado, fecha_creacion) VALUES (3, 'Profesor', 'Gestion de asistencias y evaluaciones', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol (id_rol, nombre_rol, descripcion, estado, fecha_creacion) VALUES (1, 'SuperUsuario', 'Acceso total al sistema', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol (id_rol, nombre_rol, descripcion, estado, fecha_creacion) VALUES (2, 'Director', 'Acceso a todos los módulos', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol (id_rol, nombre_rol, descripcion, estado, fecha_creacion) VALUES (12, 'Docente', 'Gestión de asistencias y evaluaciones', true, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol (id_rol, nombre_rol, descripcion, estado, fecha_creacion) VALUES (4, 'Administrativo', 'Gestión de pagos e inventario', true, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol (id_rol, nombre_rol, descripcion, estado, fecha_creacion) VALUES (14, 'Ayudante', 'Apoyo en aulas y entregas', true, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 1, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 41, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 28, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 11, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 5, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 28, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 18, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 37, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 32, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 35, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 48, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (3, 37, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 41, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 25, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 21, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 36, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 4, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 10, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 46, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (3, 1, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 34, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 22, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 29, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 15, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 27, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 40, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 43, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 39, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 17, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 3, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 47, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 45, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 31, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 46, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 23, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 29, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 31, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 6, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 30, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 42, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 38, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 14, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 23, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 39, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 16, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 25, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 47, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 43, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 40, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 7, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 31, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 20, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 18, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 24, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 33, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 39, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 46, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 19, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 17, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 28, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 42, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 45, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 30, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 19, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (3, 34, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 48, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 24, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 21, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 45, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 2, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 16, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 22, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 8, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 9, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 43, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 29, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 32, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 14, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 42, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 12, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 38, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 33, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 41, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 34, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (3, 36, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 44, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 1, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 35, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 40, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 26, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 15, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 1, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (3, 35, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 37, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 16, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 44, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 20, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 15, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 32, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 36, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 13, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 26, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (3, 31, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 33, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 14, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 47, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 48, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 44, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 27, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 27, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 34, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 38, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 30, '2026-05-06 13:36:59.1814');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 82, '2026-05-06 13:36:59.257473');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 79, '2026-05-06 13:36:59.257473');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 67, '2026-05-06 13:36:59.257473');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 82, '2026-05-06 13:36:59.257473');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (2, 82, '2026-05-06 13:36:59.257473');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (4, 79, '2026-05-06 13:36:59.257473');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 67, '2026-05-06 13:36:59.257473');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (3, 82, '2026-05-06 13:36:59.257473');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (1, 79, '2026-05-06 13:36:59.257473');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (12, 31, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (12, 35, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (12, 1, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (14, 35, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (12, 37, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (12, 36, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (14, 36, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (14, 37, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (14, 31, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) VALUES (14, 1, '2026-05-06 21:52:46.892993');
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 26);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 25);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 24);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 23);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 22);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 21);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 20);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 19);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 18);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 17);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 16);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 15);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 14);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 13);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 12);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 11);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 10);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 9);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 8);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 7);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 6);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 5);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 4);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 3);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 2);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 1);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 26);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 25);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 24);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 23);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 22);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 21);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 20);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 19);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 18);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 17);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 16);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 15);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 14);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 13);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 12);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 11);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 10);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 9);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 8);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 7);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 6);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 5);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 1);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (3, 25);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (3, 18);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (3, 17);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (3, 16);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (3, 15);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (3, 14);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (3, 11);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (3, 1);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 26);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 25);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 24);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 23);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 22);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 21);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 20);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 19);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 14);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 13);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 12);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 11);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 10);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 5);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (4, 1);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (1, 70);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (2, 70);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (12, 1);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (12, 11);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (12, 16);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (12, 15);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (12, 18);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (12, 17);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (12, 25);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (12, 24);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (12, 23);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (12, 26);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (14, 1);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (14, 11);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (14, 16);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (14, 15);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (14, 24);
INSERT INTO public.rol_permiso (id_rol, id_permiso) VALUES (14, 23);
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (1, 'Ana', 'Mamani', 'TUT-3001', 'Femenino', '70010001', 'ana.mamani@local.test', 'Zona Central 123', '2026-05-06 13:36:59.335787');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (2, 'Jorge', 'Flores', 'TUT-3002', 'Masculino', '70010002', 'jorge.flores@local.test', 'Av. Libertad 45', '2026-05-06 13:36:59.335787');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (3, 'Patricia', 'Vargas', 'TUT-3003', 'Femenino', '70010003', 'patricia.vargas@local.test', 'Barrio Norte 89', '2026-05-06 13:36:59.335787');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (4, 'Roberto', 'Choque', 'TUT-3004', 'Masculino', '70010004', 'roberto.choque@local.test', 'Calle Comercio 77', '2026-05-06 13:36:59.335787');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (5, 'Elena', 'Cruz', 'TUT-3005', 'Femenino', '70010005', 'elena.cruz@local.test', 'Zona Sur 321', '2026-05-06 13:36:59.335787');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (6, 'Roberto', 'Alvarado Mendoza', '3456701', 'Masculino', '78901234', 'ralvarado@gmail.com', 'B/ San Martín #120', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (7, 'Sandra', 'Cuellar Vaca', '3456702', 'Femenino', '78901235', 'scuellar@gmail.com', 'B/ San Martín #120', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (8, 'Miguel', 'Andreu Peña', '3456703', 'Masculino', '69012345', 'mandreu@gmail.com', 'Av. Cristo Redentor #340', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (9, 'Carla', 'Lopez Gutiérrez', '3456704', 'Femenino', '69012346', 'clopez@hotmail.com', 'B/ Los Olivos #55', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (10, 'Fernando', 'Azurduy Rojas', '3456705', 'Masculino', '72345678', 'fazurduy@gmail.com', 'Urb. El Recreo, Casa 12', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (11, 'Patricia', 'Cuellar Montaño', '3456706', 'Femenino', '72345679', 'pcuellar@gmail.com', 'Urb. El Recreo, Casa 12', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (12, 'David', 'Castro Guzmán', '3456707', 'Masculino', '75678901', 'dcastro@hotmail.com', 'Av. Busch #789', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (13, 'Claudia', 'Andrade Quiroga', '3456708', 'Femenino', '75678902', 'candrade@gmail.com', 'B/ Miraflores #45', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (14, 'Ricardo', 'Crespo Tapia', '3456709', 'Masculino', '68901234', 'rcrespo@gmail.com', 'Av. Santos Dumont #1200', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (15, 'Elena', 'Mallcu Ticona', '3456710', 'Femenino', '68901235', 'emallcu@gmail.com', 'Av. Santos Dumont #1200', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (16, 'Gonzalo', 'Cuellar Arce', '3456711', 'Masculino', '71234567', 'gcuellar@hotmail.com', 'B/ Urbari #78', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (17, 'Jorge', 'Espinosa Paz', '3456712', 'Masculino', '71234568', 'jespinosa@gmail.com', 'Av. Alemana #567', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (18, 'Mónica', 'Fuentes Rocha', '3456713', 'Femenino', '74567890', 'mfuentes@gmail.com', 'Av. Alemana #567', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (19, 'Diego', 'Farell Suárez', '3456714', 'Masculino', '74567891', 'dfarell@gmail.com', 'B/ Equipetrol Norte #34', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (20, 'Adriana', 'Moya Gutiérrez', '3456715', 'Femenino', '77890123', 'amoya@gmail.com', 'B/ Equipetrol Norte #34', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) VALUES (21, 'Ramiro', 'Torrez Gutierrez', '3456716', 'Masculino', '76543210', 'rtorrez@gmail.com', 'Av. Banzer #890', '2026-05-06 21:52:46.892993');
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (1, 1, 1, 'Madre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (2, 2, 2, 'Padre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (3, 3, 3, 'Madre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (4, 4, 4, 'Padre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (5, 5, 5, 'Madre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (6, 6, 6, 'padre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (7, 7, 6, 'madre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (8, 8, 7, 'padre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (9, 9, 8, 'madre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (10, 10, 9, 'padre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (11, 11, 9, 'madre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (12, 12, 10, 'padre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (13, 13, 11, 'madre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (14, 14, 12, 'padre', true, false);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (15, 15, 12, 'madre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (16, 16, 13, 'padre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (17, 17, 14, 'padre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (18, 18, 14, 'madre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (19, 19, 15, 'padre', true, false);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (20, 20, 15, 'madre', true, true);
INSERT INTO public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) VALUES (21, 21, 7, 'tio', false, false);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (2, 'prof_maria', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 3, true, NULL, '2026-05-06 13:36:59.335787', 'maria.quiroga@local.test', 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (3, 'prof_carlos', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 3, true, NULL, '2026-05-06 13:36:59.335787', 'carlos.rojas@local.test', 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (4, 'admin_demo', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 4, true, NULL, '2026-05-06 13:36:59.335787', 'admin.demo@local.test', 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (1, 'superuser', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 1, true, '2026-05-06 18:47:07.710523', '2026-05-06 13:36:59.1814', 'superuser@local.test', 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (15, 'admin', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 1, true, '2026-03-28 14:30:00', '2026-05-06 21:52:46.892993', NULL, 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (16, 'directora', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 2, true, '2026-03-28 08:15:00', '2026-05-06 21:52:46.892993', NULL, 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (17, 'rflores', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 12, true, '2026-03-28 08:05:00', '2026-05-06 21:52:46.892993', NULL, 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (18, 'lchoque', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 12, true, '2026-03-26 16:00:00', '2026-05-06 21:52:46.892993', NULL, 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (19, 'cvillca', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 12, true, '2026-03-28 08:00:00', '2026-05-06 21:52:46.892993', NULL, 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (20, 'jmamani', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 12, true, '2026-03-27 15:00:00', '2026-05-06 21:52:46.892993', NULL, 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (21, 'mquispe', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 12, true, '2026-03-28 07:50:00', '2026-05-06 21:52:46.892993', NULL, 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (22, 'secretaria', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 4, true, '2026-03-28 08:00:00', '2026-05-06 21:52:46.892993', NULL, 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (23, 'ayudante2', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 14, true, '2026-03-28 07:45:00', '2026-05-06 21:52:46.892993', NULL, 0, NULL, NULL, NULL);
INSERT INTO public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) VALUES (24, 'ayudante1', '$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy', 14, true, '2026-03-28 07:45:00', '2026-05-06 21:52:46.892993', NULL, 0, NULL, NULL, NULL);
SELECT pg_catalog.setval('public.actividad_evaluacion_id_actividad_seq', 55, true);
SELECT pg_catalog.setval('public.asistencia_id_asistencia_seq', 55, true);
SELECT pg_catalog.setval('public.aula_id_aula_seq', 22, true);
SELECT pg_catalog.setval('public.aviso_id_aviso_seq', 4, true);
SELECT pg_catalog.setval('public.bitacora_id_bitacora_seq', 87, true);
SELECT pg_catalog.setval('public.calificacion_id_calificacion_seq', 542, true);
SELECT pg_catalog.setval('public.campo_saber_id_campo_seq', 7, true);
SELECT pg_catalog.setval('public.comprobante_id_comprobante_seq', 28, true);
SELECT pg_catalog.setval('public.concepto_pago_id_concepto_seq', 12, true);
SELECT pg_catalog.setval('public.curso_id_curso_seq', 11, true);
SELECT pg_catalog.setval('public.curso_materia_id_curso_materia_seq', 30, true);
SELECT pg_catalog.setval('public.deuda_id_deuda_seq', 35, true);
SELECT pg_catalog.setval('public.dimension_evaluacion_id_dimension_eval_seq', 4, true);
SELECT pg_catalog.setval('public.entrega_estudiante_id_entrega_seq', 15, true);
SELECT pg_catalog.setval('public.estudiante_id_estudiante_seq', 15, true);
SELECT pg_catalog.setval('public.funcionalidad_id_funcionalidad_seq', 96, true);
SELECT pg_catalog.setval('public.gestion_academica_id_gestion_seq', 2, true);
SELECT pg_catalog.setval('public.grado_id_grado_seq', 20, true);
SELECT pg_catalog.setval('public.horario_id_horario_seq', 27, true);
SELECT pg_catalog.setval('public.inscripcion_id_inscripcion_seq', 15, true);
SELECT pg_catalog.setval('public.libreta_emitida_id_libreta_seq', 10, true);
SELECT pg_catalog.setval('public.materia_id_materia_seq', 12, true);
SELECT pg_catalog.setval('public.material_id_material_seq', 15, true);
SELECT pg_catalog.setval('public.modulo_id_modulo_seq', 45, true);
SELECT pg_catalog.setval('public.movimiento_inventario_id_movimiento_seq', 14, true);
SELECT pg_catalog.setval('public.nivel_id_nivel_seq', 8, true);
SELECT pg_catalog.setval('public.notificacion_id_notificacion_seq', 21, true);
SELECT pg_catalog.setval('public.pago_id_pago_seq', 30, true);
SELECT pg_catalog.setval('public.permiso_id_permiso_seq', 70, true);
SELECT pg_catalog.setval('public.profesor_id_profesor_seq', 18, true);
SELECT pg_catalog.setval('public.rol_id_rol_seq', 14, true);
SELECT pg_catalog.setval('public.tutor_estudiante_id_tutor_estudiante_seq', 21, true);
SELECT pg_catalog.setval('public.tutor_id_tutor_seq', 21, true);
SELECT pg_catalog.setval('public.usuario_id_usuario_seq', 24, true);
ALTER TABLE ONLY public.actividad_evaluacion
    ADD CONSTRAINT actividad_evaluacion_pkey PRIMARY KEY (id_actividad);
ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_id_estudiante_id_curso_fecha_key UNIQUE (id_estudiante, id_curso, fecha);
ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_pkey PRIMARY KEY (id_asistencia);
ALTER TABLE ONLY public.aula
    ADD CONSTRAINT aula_numero_aula_key UNIQUE (numero_aula);
ALTER TABLE ONLY public.aula
    ADD CONSTRAINT aula_pkey PRIMARY KEY (id_aula);
ALTER TABLE ONLY public.aviso
    ADD CONSTRAINT aviso_pkey PRIMARY KEY (id_aviso);
ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_pkey PRIMARY KEY (id_bitacora);
ALTER TABLE ONLY public.calificacion
    ADD CONSTRAINT calificacion_id_actividad_id_estudiante_key UNIQUE (id_actividad, id_estudiante);
ALTER TABLE ONLY public.calificacion
    ADD CONSTRAINT calificacion_pkey PRIMARY KEY (id_calificacion);
ALTER TABLE ONLY public.campo_saber
    ADD CONSTRAINT campo_saber_nombre_campo_key UNIQUE (nombre_campo);
ALTER TABLE ONLY public.campo_saber
    ADD CONSTRAINT campo_saber_orden_visualizacion_key UNIQUE (orden_visualizacion);
ALTER TABLE ONLY public.campo_saber
    ADD CONSTRAINT campo_saber_pkey PRIMARY KEY (id_campo);
ALTER TABLE ONLY public.comprobante
    ADD CONSTRAINT comprobante_id_pago_key UNIQUE (id_pago);
ALTER TABLE ONLY public.comprobante
    ADD CONSTRAINT comprobante_numero_comprobante_key UNIQUE (numero_comprobante);
ALTER TABLE ONLY public.comprobante
    ADD CONSTRAINT comprobante_pkey PRIMARY KEY (id_comprobante);
ALTER TABLE ONLY public.concepto_pago
    ADD CONSTRAINT concepto_pago_nombre_concepto_key UNIQUE (nombre_concepto);
ALTER TABLE ONLY public.concepto_pago
    ADD CONSTRAINT concepto_pago_pkey PRIMARY KEY (id_concepto);
ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_id_grado_paralelo_id_gestion_turno_key UNIQUE (id_grado, paralelo, id_gestion, turno);
ALTER TABLE ONLY public.curso_materia
    ADD CONSTRAINT curso_materia_id_curso_id_materia_key UNIQUE (id_curso, id_materia);
ALTER TABLE ONLY public.curso_materia
    ADD CONSTRAINT curso_materia_pkey PRIMARY KEY (id_curso_materia);
ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_pkey PRIMARY KEY (id_curso);
ALTER TABLE ONLY public.deuda
    ADD CONSTRAINT deuda_estudiante_gestion_concepto_mes_key UNIQUE (id_estudiante, id_gestion, id_concepto, mes);
ALTER TABLE ONLY public.deuda
    ADD CONSTRAINT deuda_pkey PRIMARY KEY (id_deuda);
ALTER TABLE ONLY public.dimension_evaluacion
    ADD CONSTRAINT dimension_evaluacion_nombre_dimension_id_gestion_key UNIQUE (nombre_dimension, id_gestion);
ALTER TABLE ONLY public.dimension_evaluacion
    ADD CONSTRAINT dimension_evaluacion_pkey PRIMARY KEY (id_dimension_eval);
ALTER TABLE ONLY public.entrega_estudiante
    ADD CONSTRAINT entrega_estudiante_pkey PRIMARY KEY (id_entrega);
ALTER TABLE ONLY public.estudiante
    ADD CONSTRAINT estudiante_ci_key UNIQUE (ci);
ALTER TABLE ONLY public.estudiante
    ADD CONSTRAINT estudiante_pkey PRIMARY KEY (id_estudiante);
ALTER TABLE ONLY public.funcionalidad
    ADD CONSTRAINT funcionalidad_metodo_id_permiso_id_modulo_key UNIQUE (metodo, id_permiso, id_modulo);
ALTER TABLE ONLY public.funcionalidad
    ADD CONSTRAINT funcionalidad_pkey PRIMARY KEY (id_funcionalidad);
ALTER TABLE ONLY public.gestion_academica
    ADD CONSTRAINT gestion_academica_anio_key UNIQUE (anio);
ALTER TABLE ONLY public.gestion_academica
    ADD CONSTRAINT gestion_academica_pkey PRIMARY KEY (id_gestion);
ALTER TABLE ONLY public.grado
    ADD CONSTRAINT grado_nombre_grado_id_nivel_key UNIQUE (nombre_grado, id_nivel);
ALTER TABLE ONLY public.grado
    ADD CONSTRAINT grado_pkey PRIMARY KEY (id_grado);
ALTER TABLE ONLY public.horario
    ADD CONSTRAINT horario_pkey PRIMARY KEY (id_horario);
ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT inscripcion_id_estudiante_id_curso_key UNIQUE (id_estudiante, id_curso);
ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT inscripcion_pkey PRIMARY KEY (id_inscripcion);
ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_estudiante_curso_gestion_trimestre_key UNIQUE (id_estudiante, id_curso, id_gestion, trimestre);
ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_pkey PRIMARY KEY (id_libreta);
ALTER TABLE ONLY public.materia
    ADD CONSTRAINT materia_pkey PRIMARY KEY (id_materia);
ALTER TABLE ONLY public.material
    ADD CONSTRAINT material_pkey PRIMARY KEY (id_material);
ALTER TABLE ONLY public.modulo
    ADD CONSTRAINT modulo_nombre_modulo_key UNIQUE (nombre_modulo);
ALTER TABLE ONLY public.modulo
    ADD CONSTRAINT modulo_pkey PRIMARY KEY (id_modulo);
ALTER TABLE ONLY public.movimiento_inventario
    ADD CONSTRAINT movimiento_inventario_pkey PRIMARY KEY (id_movimiento);
ALTER TABLE ONLY public.nivel
    ADD CONSTRAINT nivel_nombre_nivel_key UNIQUE (nombre_nivel);
ALTER TABLE ONLY public.nivel
    ADD CONSTRAINT nivel_pkey PRIMARY KEY (id_nivel);
ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_pkey PRIMARY KEY (id_notificacion);
ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_pkey PRIMARY KEY (id_pago);
ALTER TABLE ONLY public.permiso
    ADD CONSTRAINT permiso_nombre_permiso_key UNIQUE (nombre_permiso);
ALTER TABLE ONLY public.permiso
    ADD CONSTRAINT permiso_pkey PRIMARY KEY (id_permiso);
ALTER TABLE ONLY public.profesor
    ADD CONSTRAINT profesor_ci_key UNIQUE (ci);
ALTER TABLE ONLY public.profesor
    ADD CONSTRAINT profesor_id_usuario_key UNIQUE (id_usuario);
ALTER TABLE ONLY public.profesor
    ADD CONSTRAINT profesor_pkey PRIMARY KEY (id_profesor);
ALTER TABLE ONLY public.rol_funcionalidad
    ADD CONSTRAINT rol_funcionalidad_pkey PRIMARY KEY (id_rol, id_funcionalidad);
ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_nombre_rol_key UNIQUE (nombre_rol);
ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_pkey PRIMARY KEY (id_rol, id_permiso);
ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);
ALTER TABLE ONLY public.tutor
    ADD CONSTRAINT tutor_ci_key UNIQUE (ci);
ALTER TABLE ONLY public.tutor_estudiante
    ADD CONSTRAINT tutor_estudiante_id_tutor_id_estudiante_key UNIQUE (id_tutor, id_estudiante);
ALTER TABLE ONLY public.tutor_estudiante
    ADD CONSTRAINT tutor_estudiante_pkey PRIMARY KEY (id_tutor_estudiante);
ALTER TABLE ONLY public.tutor
    ADD CONSTRAINT tutor_pkey PRIMARY KEY (id_tutor);
ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);
ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_username_key UNIQUE (username);
ALTER TABLE public.aviso ADD CONSTRAINT fk_aviso_estudiante 
    FOREIGN KEY (id_estudiante_destino) REFERENCES public.estudiante(id_estudiante) ON DELETE SET NULL;
CREATE INDEX idx_asistencia_estudiante ON public.asistencia USING btree (id_estudiante);
CREATE INDEX idx_asistencia_fecha ON public.asistencia USING btree (fecha);
CREATE INDEX idx_bitacora_fecha ON public.bitacora USING btree (fecha_hora);
CREATE INDEX idx_bitacora_tabla ON public.bitacora USING btree (tabla_afectada);
CREATE INDEX idx_bitacora_usuario ON public.bitacora USING btree (id_usuario);
CREATE INDEX idx_calificacion_actividad ON public.calificacion USING btree (id_actividad);
CREATE INDEX idx_calificacion_estudiante ON public.calificacion USING btree (id_estudiante);
CREATE INDEX idx_curso_gestion ON public.curso USING btree (id_gestion);
CREATE INDEX idx_curso_grado ON public.curso USING btree (id_grado);
CREATE INDEX idx_deuda_estado ON public.deuda USING btree (estado);
CREATE INDEX idx_deuda_estudiante ON public.deuda USING btree (id_estudiante);
CREATE INDEX idx_funcionalidad_modulo ON public.funcionalidad USING btree (id_modulo);
CREATE INDEX idx_funcionalidad_permiso ON public.funcionalidad USING btree (id_permiso);
CREATE INDEX idx_inscripcion_curso ON public.inscripcion USING btree (id_curso);
CREATE INDEX idx_inscripcion_estudiante ON public.inscripcion USING btree (id_estudiante);
CREATE INDEX idx_materia_campo ON public.materia USING btree (id_campo);
CREATE INDEX idx_pago_deuda ON public.pago USING btree (id_deuda);
CREATE INDEX idx_pago_estudiante ON public.pago USING btree (id_estudiante);
CREATE UNIQUE INDEX idx_usuario_email_unique ON public.usuario USING btree (email) WHERE (email IS NOT NULL);
CREATE INDEX idx_usuario_rol ON public.usuario USING btree (id_rol);
CREATE TRIGGER trg_actualizar_deuda_al_pagar AFTER INSERT OR UPDATE ON public.pago FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_deuda_al_pagar();
CREATE TRIGGER trg_actualizar_stock AFTER INSERT ON public.movimiento_inventario FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_stock();
CREATE TRIGGER trg_bitacora_asistencia AFTER INSERT OR UPDATE ON public.asistencia FOR EACH ROW EXECUTE FUNCTION public.fn_bitacora_asistencia();
CREATE TRIGGER trg_bitacora_entrega AFTER INSERT ON public.entrega_estudiante FOR EACH ROW EXECUTE FUNCTION public.fn_bitacora_entrega();
CREATE TRIGGER trg_bitacora_pago AFTER INSERT OR UPDATE ON public.pago FOR EACH ROW EXECUTE FUNCTION public.fn_bitacora_pago();
CREATE TRIGGER trg_calcular_edad BEFORE INSERT OR UPDATE OF fecha_nacimiento ON public.estudiante FOR EACH ROW EXECUTE FUNCTION public.fn_calcular_edad();
CREATE TRIGGER trg_validar_entrega_autorizada BEFORE INSERT ON public.entrega_estudiante FOR EACH ROW EXECUTE FUNCTION public.fn_validar_entrega_autorizada();
CREATE TRIGGER trg_validar_inscripcion_unica BEFORE INSERT OR UPDATE ON public.inscripcion FOR EACH ROW EXECUTE FUNCTION public.fn_validar_inscripcion_unica();
CREATE TRIGGER trg_validar_nota_maxima BEFORE INSERT OR UPDATE ON public.calificacion FOR EACH ROW EXECUTE FUNCTION public.fn_validar_nota_maxima();
CREATE TRIGGER trg_verificar_mora_al_generar_deuda AFTER INSERT ON public.deuda FOR EACH ROW EXECUTE FUNCTION public.fn_marcar_deudas_en_mora();
ALTER TABLE ONLY public.actividad_evaluacion
    ADD CONSTRAINT actividad_evaluacion_id_curso_materia_fkey FOREIGN KEY (id_curso_materia) REFERENCES public.curso_materia(id_curso_materia);
ALTER TABLE ONLY public.actividad_evaluacion
    ADD CONSTRAINT actividad_evaluacion_id_dimension_eval_fkey FOREIGN KEY (id_dimension_eval) REFERENCES public.dimension_evaluacion(id_dimension_eval);
ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso);
ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);
ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_id_usuario_registro_fkey FOREIGN KEY (id_usuario_registro) REFERENCES public.usuario(id_usuario);
ALTER TABLE ONLY public.aviso
    ADD CONSTRAINT aviso_id_curso_destino_fkey FOREIGN KEY (id_curso_destino) REFERENCES public.curso(id_curso);
ALTER TABLE ONLY public.aviso
    ADD CONSTRAINT aviso_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);
ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_id_funcionalidad_fkey FOREIGN KEY (id_funcionalidad) REFERENCES public.funcionalidad(id_funcionalidad);
ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_id_modulo_fkey FOREIGN KEY (id_modulo) REFERENCES public.modulo(id_modulo);
ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);
ALTER TABLE ONLY public.calificacion
    ADD CONSTRAINT calificacion_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES public.actividad_evaluacion(id_actividad);
ALTER TABLE ONLY public.calificacion
    ADD CONSTRAINT calificacion_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);
ALTER TABLE ONLY public.comprobante
    ADD CONSTRAINT comprobante_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES public.pago(id_pago);
ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_id_aula_fkey FOREIGN KEY (id_aula) REFERENCES public.aula(id_aula);
ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_id_gestion_fkey FOREIGN KEY (id_gestion) REFERENCES public.gestion_academica(id_gestion);
ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grado(id_grado);
ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_id_profesor_fkey FOREIGN KEY (id_profesor) REFERENCES public.profesor(id_profesor);
ALTER TABLE ONLY public.curso_materia
    ADD CONSTRAINT curso_materia_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso);
ALTER TABLE ONLY public.curso_materia
    ADD CONSTRAINT curso_materia_id_materia_fkey FOREIGN KEY (id_materia) REFERENCES public.materia(id_materia);
ALTER TABLE ONLY public.curso_materia
    ADD CONSTRAINT curso_materia_id_profesor_fkey FOREIGN KEY (id_profesor) REFERENCES public.profesor(id_profesor);
ALTER TABLE ONLY public.deuda
    ADD CONSTRAINT deuda_id_concepto_fkey FOREIGN KEY (id_concepto) REFERENCES public.concepto_pago(id_concepto);
ALTER TABLE ONLY public.deuda
    ADD CONSTRAINT deuda_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);
ALTER TABLE ONLY public.deuda
    ADD CONSTRAINT deuda_id_gestion_fkey FOREIGN KEY (id_gestion) REFERENCES public.gestion_academica(id_gestion);
ALTER TABLE ONLY public.dimension_evaluacion
    ADD CONSTRAINT dimension_evaluacion_id_gestion_fkey FOREIGN KEY (id_gestion) REFERENCES public.gestion_academica(id_gestion);
ALTER TABLE ONLY public.entrega_estudiante
    ADD CONSTRAINT entrega_estudiante_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);
ALTER TABLE ONLY public.entrega_estudiante
    ADD CONSTRAINT entrega_estudiante_id_tutor_fkey FOREIGN KEY (id_tutor) REFERENCES public.tutor(id_tutor);
ALTER TABLE ONLY public.entrega_estudiante
    ADD CONSTRAINT entrega_estudiante_id_usuario_supervisor_fkey FOREIGN KEY (id_usuario_supervisor) REFERENCES public.usuario(id_usuario);
ALTER TABLE ONLY public.funcionalidad
    ADD CONSTRAINT funcionalidad_id_modulo_fkey FOREIGN KEY (id_modulo) REFERENCES public.modulo(id_modulo) ON DELETE CASCADE;
ALTER TABLE ONLY public.funcionalidad
    ADD CONSTRAINT funcionalidad_id_permiso_fkey FOREIGN KEY (id_permiso) REFERENCES public.permiso(id_permiso) ON DELETE CASCADE;
ALTER TABLE ONLY public.grado
    ADD CONSTRAINT grado_id_nivel_fkey FOREIGN KEY (id_nivel) REFERENCES public.nivel(id_nivel);
ALTER TABLE ONLY public.horario
    ADD CONSTRAINT horario_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso);
ALTER TABLE ONLY public.horario
    ADD CONSTRAINT horario_id_materia_fkey FOREIGN KEY (id_materia) REFERENCES public.materia(id_materia);
ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT inscripcion_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso);
ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT inscripcion_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);
ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso);
ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);
ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_id_gestion_fkey FOREIGN KEY (id_gestion) REFERENCES public.gestion_academica(id_gestion);
ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_id_usuario_aprobador_fkey FOREIGN KEY (id_usuario_aprobador) REFERENCES public.usuario(id_usuario);
ALTER TABLE ONLY public.materia
    ADD CONSTRAINT materia_id_campo_fkey FOREIGN KEY (id_campo) REFERENCES public.campo_saber(id_campo);
ALTER TABLE ONLY public.movimiento_inventario
    ADD CONSTRAINT movimiento_inventario_id_material_fkey FOREIGN KEY (id_material) REFERENCES public.material(id_material);
ALTER TABLE ONLY public.movimiento_inventario
    ADD CONSTRAINT movimiento_inventario_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);
ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_id_aviso_fkey FOREIGN KEY (id_aviso) REFERENCES public.aviso(id_aviso);
ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_id_tutor_fkey FOREIGN KEY (id_tutor) REFERENCES public.tutor(id_tutor);
ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_id_deuda_fkey FOREIGN KEY (id_deuda) REFERENCES public.deuda(id_deuda);
ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);
ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_id_usuario_registro_fkey FOREIGN KEY (id_usuario_registro) REFERENCES public.usuario(id_usuario);
ALTER TABLE ONLY public.profesor
    ADD CONSTRAINT profesor_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);
ALTER TABLE ONLY public.rol_funcionalidad
    ADD CONSTRAINT rol_funcionalidad_id_funcionalidad_fkey FOREIGN KEY (id_funcionalidad) REFERENCES public.funcionalidad(id_funcionalidad) ON DELETE CASCADE;
ALTER TABLE ONLY public.rol_funcionalidad
    ADD CONSTRAINT rol_funcionalidad_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol) ON DELETE CASCADE;
ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_id_permiso_fkey FOREIGN KEY (id_permiso) REFERENCES public.permiso(id_permiso) ON DELETE CASCADE;
ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol) ON DELETE CASCADE;
ALTER TABLE ONLY public.tutor_estudiante
    ADD CONSTRAINT tutor_estudiante_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);
ALTER TABLE ONLY public.tutor_estudiante
    ADD CONSTRAINT tutor_estudiante_id_tutor_fkey FOREIGN KEY (id_tutor) REFERENCES public.tutor(id_tutor);
ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol);

-- Columnas y FK de estudiante (idempotentes)
ALTER TABLE public.estudiante ADD COLUMN IF NOT EXISTS id_usuario INTEGER;
ALTER TABLE public.estudiante ADD COLUMN IF NOT EXISTS rude CHARACTER VARYING(17);
ALTER TABLE public.estudiante ALTER COLUMN rude TYPE CHARACTER VARYING(17);

CREATE INDEX IF NOT EXISTS idx_aviso_estudiante_destino ON public.aviso(id_estudiante_destino);
CREATE INDEX IF NOT EXISTS idx_aviso_destinatario_estado ON public.aviso(destinatario_tipo, estado);
CREATE INDEX IF NOT EXISTS idx_aviso_fecha_envio ON public.aviso(fecha_envio DESC);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'estudiante' AND constraint_name = 'estudiante_id_usuario_key'
    ) THEN
        ALTER TABLE public.estudiante ADD CONSTRAINT estudiante_id_usuario_key UNIQUE (id_usuario);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'estudiante' AND constraint_name = 'fk_estudiante_usuario'
    ) THEN
        ALTER TABLE public.estudiante ADD CONSTRAINT fk_estudiante_usuario
            FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'estudiante' AND constraint_name = 'estudiante_rude_unique'
    ) THEN
        ALTER TABLE public.estudiante ADD CONSTRAINT estudiante_rude_unique UNIQUE (rude);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estudiante_rude ON public.estudiante(rude);

COMMENT ON COLUMN public.estudiante.rude IS 'Código de registro único del estudiante (16-17 dígitos numéricos)';

-- Corrige CI con formato invalido (debe ser 6-8 digitos, opcionalmente con guion + complemento, ej: 1047514 o 51362589-1A)
UPDATE public.estudiante SET ci = '5234871'        WHERE id_estudiante = 1 AND ci = 'EST-2001';
UPDATE public.estudiante SET ci = '6123487-2A'      WHERE id_estudiante = 2 AND ci = 'EST-2002';
UPDATE public.estudiante SET ci = '4789213'         WHERE id_estudiante = 3 AND ci = 'EST-2003';
UPDATE public.estudiante SET ci = '7345612'         WHERE id_estudiante = 4 AND ci = 'EST-2004';
UPDATE public.estudiante SET ci = '5894231-1K'      WHERE id_estudiante = 5 AND ci = 'EST-2005';

-- Asigna un RUDE aleatorio (16-17 digitos numericos) a los estudiantes que no tengan uno
UPDATE public.estudiante SET rude = '6557503334381304'   WHERE id_estudiante = 1  AND rude IS NULL;
UPDATE public.estudiante SET rude = '99644951413793235'  WHERE id_estudiante = 2  AND rude IS NULL;
UPDATE public.estudiante SET rude = '17580590832339469'  WHERE id_estudiante = 3  AND rude IS NULL;
UPDATE public.estudiante SET rude = '83980894241404808'  WHERE id_estudiante = 4  AND rude IS NULL;
UPDATE public.estudiante SET rude = '52017902317029368'  WHERE id_estudiante = 5  AND rude IS NULL;
UPDATE public.estudiante SET rude = '38871082959952959'  WHERE id_estudiante = 6  AND rude IS NULL;
UPDATE public.estudiante SET rude = '15647053551720145'  WHERE id_estudiante = 7  AND rude IS NULL;
UPDATE public.estudiante SET rude = '40950344661561414'  WHERE id_estudiante = 8  AND rude IS NULL;
UPDATE public.estudiante SET rude = '6886830212086724'   WHERE id_estudiante = 9  AND rude IS NULL;
UPDATE public.estudiante SET rude = '9668221552999479'   WHERE id_estudiante = 10 AND rude IS NULL;
UPDATE public.estudiante SET rude = '8382566717096205'   WHERE id_estudiante = 11 AND rude IS NULL;
UPDATE public.estudiante SET rude = '5538819344072720'   WHERE id_estudiante = 12 AND rude IS NULL;
UPDATE public.estudiante SET rude = '5582555356445058'   WHERE id_estudiante = 13 AND rude IS NULL;
UPDATE public.estudiante SET rude = '97289417475964711'  WHERE id_estudiante = 14 AND rude IS NULL;
UPDATE public.estudiante SET rude = '4654533671392285'   WHERE id_estudiante = 15 AND rude IS NULL;

-- Rol y permisos de estudiante
INSERT INTO public.rol (nombre_rol, descripcion, estado, fecha_creacion)
VALUES ('Estudiante', 'Rol para estudiantes: acceso a sus datos, calificaciones, pagos y perfil', true, NOW())
ON CONFLICT (nombre_rol) DO NOTHING;

INSERT INTO public.permiso (nombre_permiso, descripcion) VALUES
('ver_mis_datos', 'Ver sus propios datos personales'),
('ver_mis_calificaciones', 'Ver sus propias calificaciones'),
('ver_mis_pagos', 'Ver sus propios pagos y deudas'),
('realizar_pago', 'Realizar pagos en línea')
ON CONFLICT (nombre_permiso) DO NOTHING;

WITH rol_estudiante AS (
    SELECT id_rol FROM public.rol WHERE nombre_rol = 'Estudiante'
)
INSERT INTO public.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol_estudiante r
CROSS JOIN public.permiso p
WHERE p.nombre_permiso IN ('ver_mis_datos', 'ver_mis_calificaciones', 'ver_mis_pagos', 'realizar_pago')
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

-- Columnas y constraints de pago para Stripe (idempotentes)
ALTER TABLE public.pago DROP CONSTRAINT IF EXISTS pago_metodo_pago_check;
ALTER TABLE public.pago ADD CONSTRAINT pago_metodo_pago_check CHECK (metodo_pago IN ('efectivo', 'QR', 'transferencia', 'stripe'));

ALTER TABLE public.pago DROP CONSTRAINT IF EXISTS pago_estado_check;
ALTER TABLE public.pago ADD CONSTRAINT pago_estado_check CHECK (estado IN ('pendiente_validacion', 'validado', 'rechazado', 'completado'));

ALTER TABLE public.pago ADD COLUMN IF NOT EXISTS id_stripe_payment VARCHAR(255);
ALTER TABLE public.pago ALTER COLUMN id_usuario_registro DROP NOT NULL;


-- =====================================================================
-- Modulo Libretas: alinear esquema con libretaController (idempotente)
-- =====================================================================

-- 1. Columnas que el controller usa y faltan en libreta_emitida
ALTER TABLE public.libreta_emitida
  ADD COLUMN IF NOT EXISTS id_usuario_generador integer,
  ADD COLUMN IF NOT EXISTS id_usuario_remitente integer,
  ADD COLUMN IF NOT EXISTS id_inscripcion       integer,
  ADD COLUMN IF NOT EXISTS fecha_generacion     timestamp without time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fecha_remision       timestamp without time zone,
  ADD COLUMN IF NOT EXISTS observaciones        text,
  ADD COLUMN IF NOT EXISTS promedio_general     numeric(6,2),
  ADD COLUMN IF NOT EXISTS version              integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at           timestamp without time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at           timestamp without time zone DEFAULT now();

-- 2. FKs de libreta_emitida (idempotentes)
ALTER TABLE public.libreta_emitida DROP CONSTRAINT IF EXISTS fk_libreta_generador;
ALTER TABLE public.libreta_emitida ADD CONSTRAINT fk_libreta_generador
  FOREIGN KEY (id_usuario_generador) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;

ALTER TABLE public.libreta_emitida DROP CONSTRAINT IF EXISTS fk_libreta_remitente;
ALTER TABLE public.libreta_emitida ADD CONSTRAINT fk_libreta_remitente
  FOREIGN KEY (id_usuario_remitente) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;

ALTER TABLE public.libreta_emitida DROP CONSTRAINT IF EXISTS fk_libreta_inscripcion;
ALTER TABLE public.libreta_emitida ADD CONSTRAINT fk_libreta_inscripcion
  FOREIGN KEY (id_inscripcion) REFERENCES public.inscripcion(id_inscripcion) ON DELETE SET NULL;

-- 3. Estados reales que maneja el codigo (reemplaza el CHECK viejo)
ALTER TABLE public.libreta_emitida DROP CONSTRAINT IF EXISTS libreta_emitida_estado_check;
ALTER TABLE public.libreta_emitida ADD CONSTRAINT libreta_emitida_estado_check
  CHECK (estado IN ('borrador','PENDIENTE_REVISION','PENDIENTE_APROBACION','APROBADA','aprobada','entregada'));

-- 4. Tabla libreta_detalle (notas por materia)
CREATE TABLE IF NOT EXISTS public.libreta_detalle (
    id_libreta_detalle        SERIAL PRIMARY KEY,
    id_libreta                integer NOT NULL,
    id_materia                integer NOT NULL,
    nombre_materia_historico  varchar(150),
    id_campo                  integer,
    nombre_campo_historico    varchar(150),
    nota_primer_trimestre     numeric(6,2),
    nota_segundo_trimestre    numeric(6,2),
    nota_tercer_trimestre     numeric(6,2),
    promedio_anual            numeric(6,2),
    promedio_literal          varchar(20),
    observacion               text,
    orden                     integer,
    created_at                timestamp without time zone DEFAULT now(),
    updated_at                timestamp without time zone DEFAULT now(),
    CONSTRAINT fk_ld_libreta FOREIGN KEY (id_libreta)
        REFERENCES public.libreta_emitida(id_libreta) ON DELETE CASCADE,
    CONSTRAINT fk_ld_materia FOREIGN KEY (id_materia)
        REFERENCES public.materia(id_materia)
);
CREATE INDEX IF NOT EXISTS idx_ld_libreta ON public.libreta_detalle (id_libreta);

-- 5. Tabla libreta_dimension (notas por dimension Ser/Saber/Hacer/Autoevaluacion)
CREATE TABLE IF NOT EXISTS public.libreta_dimension (
    id_libreta_dimension        SERIAL PRIMARY KEY,
    id_libreta_detalle          integer NOT NULL,
    id_dimension_eval           integer,
    nombre_dimension_historico  varchar(50),
    trimestre                   integer,
    calificacion                numeric(6,2),
    ponderacion                 numeric(6,2),
    created_at                  timestamp without time zone DEFAULT now(),
    updated_at                  timestamp without time zone DEFAULT now(),
    CONSTRAINT fk_ldim_detalle FOREIGN KEY (id_libreta_detalle)
        REFERENCES public.libreta_detalle(id_libreta_detalle) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ldim_detalle ON public.libreta_dimension (id_libreta_detalle);


CREATE TABLE public.horario_atencion (
    id_horario_atencion SERIAL PRIMARY KEY,
    id_profesor INTEGER NOT NULL REFERENCES public.profesor(id_profesor) ON DELETE CASCADE,
    dia_semana VARCHAR(10) NOT NULL CHECK (dia_semana IN ('lunes','martes','miercoles','jueves','viernes','sabado')),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    modalidad VARCHAR(20) NOT NULL CHECK (modalidad IN ('presencial','virtual')),
    enlace_videollamada VARCHAR(255) NULL,
    estado VARCHAR(20) DEFAULT 'disponible' CHECK (estado IN ('disponible','ocupado','cancelado')),
    creado_en TIMESTAMP DEFAULT now(),
    UNIQUE (id_profesor, dia_semana, hora_inicio, hora_fin)
);

CREATE TABLE public.cita (
    id_cita SERIAL PRIMARY KEY,
    id_horario_atencion INTEGER NOT NULL REFERENCES public.horario_atencion(id_horario_atencion) ON DELETE RESTRICT,
    id_profesor INTEGER NOT NULL REFERENCES public.profesor(id_profesor),
    id_tutor INTEGER NOT NULL REFERENCES public.tutor(id_tutor),
    id_estudiante INTEGER NOT NULL REFERENCES public.estudiante(id_estudiante),
    motivo TEXT NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmada','realizada','cancelada','alternativa')),
    fecha_cita DATE,
    fecha_solicitud TIMESTAMP DEFAULT now(),
    fecha_confirmacion TIMESTAMP NULL,
    mensaje_alternativa TEXT NULL,
    creado_en TIMESTAMP DEFAULT now(),
    actualizado_en TIMESTAMP DEFAULT now()
);

ALTER TABLE public.notificacion ADD COLUMN id_cita INTEGER NULL;
ALTER TABLE public.notificacion ADD CONSTRAINT fk_notificacion_cita
    FOREIGN KEY (id_cita) REFERENCES public.cita(id_cita) ON DELETE SET NULL;
-- Permitir NULL en id_aviso: una notificación de cita (recordatorio) no está
-- ligada a un aviso.
ALTER TABLE public.notificacion ALTER COLUMN id_aviso DROP NOT NULL;

CREATE TABLE public.licencia_profesor (
    id_licencia SERIAL PRIMARY KEY,
    id_profesor INTEGER NOT NULL REFERENCES public.profesor(id_profesor),
    tipo_licencia VARCHAR(30) NOT NULL CHECK (tipo_licencia IN ('medica', 'vacaciones', 'personal', 'permiso', 'otro')),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    motivo TEXT,
    documento_url VARCHAR(255),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
    id_usuario_aprobador INTEGER REFERENCES public.usuario(id_usuario),
    fecha_aprobacion TIMESTAMP,
    observaciones_aprobador TEXT,
    fecha_solicitud TIMESTAMP DEFAULT now(),
    creado_en TIMESTAMP DEFAULT now(),
    actualizado_en TIMESTAMP DEFAULT now()
);

CREATE TABLE public.reemplazo_profesor (
    id_reemplazo SERIAL PRIMARY KEY,
    id_licencia INTEGER NOT NULL REFERENCES public.licencia_profesor(id_licencia) ON DELETE CASCADE,
    id_profesor_suplente INTEGER NOT NULL REFERENCES public.profesor(id_profesor),
    id_curso_materia INTEGER NOT NULL REFERENCES public.curso_materia(id_curso_materia),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    observaciones TEXT,
    creado_en TIMESTAMP DEFAULT now()
);

-- Estado del reemplazo (usado por reemplazoController: asignar/sugerir/cerrar)
ALTER TABLE public.reemplazo_profesor
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'activa'
    CHECK (estado IN ('activa', 'finalizada', 'cancelada'));

ALTER TABLE public.licencia_profesor 
    ADD COLUMN fecha_fin_real DATE NULL,
    ADD COLUMN id_usuario_registro INTEGER REFERENCES public.usuario(id_usuario),
    ADD COLUMN comentario_director TEXT; -- o usar observaciones_aprobador, pero es más claro separar

-- 2. Modificar CHECK de estado para incluir nuevos estados
ALTER TABLE public.licencia_profesor
    DROP CONSTRAINT licencia_profesor_estado_check;
ALTER TABLE public.licencia_profesor
    ADD CONSTRAINT licencia_profesor_estado_check
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada', 'pendiente_doc', 'cerrada'));

-- 2b. Incluir 'extension' en el CHECK de tipo_licencia (usado por solicitarExtension)
ALTER TABLE public.licencia_profesor
    DROP CONSTRAINT IF EXISTS licencia_profesor_tipo_licencia_check;
ALTER TABLE public.licencia_profesor
    ADD CONSTRAINT licencia_profesor_tipo_licencia_check
    CHECK (tipo_licencia IN ('medica', 'vacaciones', 'personal', 'permiso', 'otro', 'extension'));

-- 3. Agregar campo estado_laboral a profesor
ALTER TABLE public.profesor 
    ADD COLUMN estado_laboral VARCHAR(20) DEFAULT 'activo' 
    CHECK (estado_laboral IN ('activo', 'con_licencia', 'inactivo'));

-- 4. Índice para búsquedas rápidas
CREATE INDEX idx_licencia_profesor_fechas ON public.licencia_profesor(fecha_inicio, fecha_fin);
CREATE INDEX idx_licencia_profesor_estado ON public.licencia_profesor(estado);
CREATE INDEX idx_profesor_estado_laboral ON public.profesor(estado_laboral);

CREATE OR REPLACE FUNCTION public.actualizar_estado_profesor_licencia()
RETURNS TRIGGER AS $$
BEGIN
    -- Si la licencia se aprueba, actualizar estado del profesor
    IF NEW.estado = 'aprobada' AND OLD.estado != 'aprobada' THEN
        UPDATE profesor SET estado_laboral = 'con_licencia' 
        WHERE id_profesor = NEW.id_profesor;
    END IF;
    
    -- Si la licencia se cierra (manual o automáticamente), restaurar estado
    IF NEW.estado = 'cerrada' AND OLD.estado != 'cerrada' THEN
        UPDATE profesor SET estado_laboral = 'activo' 
        WHERE id_profesor = NEW.id_profesor;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;



ALTER TABLE public.licencia_profesor 
ADD COLUMN IF NOT EXISTS fecha_fin_real DATE NULL,
ADD COLUMN IF NOT EXISTS comentario_director TEXT NULL,
ADD COLUMN IF NOT EXISTS id_usuario_registro INTEGER REFERENCES public.usuario(id_usuario),
ADD COLUMN IF NOT EXISTS registrado_por_secretaria BOOLEAN DEFAULT FALSE;


CREATE TRIGGER trg_actualizar_estado_profesor
AFTER UPDATE OF estado ON public.licencia_profesor
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_estado_profesor_licencia();
-- =====================================================================
-- Seed: poblar la gestion 2025 (id_gestion = 2) para probar libretas.
-- Crea curso, inscripciones, materias, dimensiones, actividades y notas
-- completas (T1-T3) para que libretaController genere libretas sin
-- calificaciones pendientes. Solo corre si 2025 no tiene cursos.
-- =====================================================================
-- Restaurar search_path: los INSERT del seed disparan triggers (bitacora,
-- inventario) cuyos cuerpos usan nombres sin esquema; con search_path vacio
-- (fijado por pg_dump) fallarian. Esto aplica al resto del script.
SET search_path TO public;

DO $$
DECLARE
  v_gestion     integer := 2;                       -- gestion 2025
  v_curso       integer;
  v_cm          integer;
  v_act         integer;
  v_dim         RECORD;
  v_mat         integer;
  v_tri         integer;
  v_est         integer;
  v_nota        numeric;
  v_materias    integer[] := ARRAY[1, 2, 3, 4, 8];  -- Lenguaje, Matematicas, CC.NN., Valores, CC.SS.
  v_estudiantes integer[] := ARRAY[1, 2, 3, 4, 5];
BEGIN
  IF EXISTS (SELECT 1 FROM public.curso WHERE id_gestion = v_gestion) THEN
    RAISE NOTICE 'Gestion 2025 ya tiene cursos; no se puebla.';
    RETURN;
  END IF;

  -- Dimensiones de evaluacion para 2025 (mismas ponderaciones que 2026)
  INSERT INTO public.dimension_evaluacion (nombre_dimension, puntaje_maximo, id_gestion)
  SELECT d.nombre, d.pmax, v_gestion
  FROM (VALUES ('Ser', 10), ('Saber', 45), ('Hacer', 40), ('Autoevaluacion', 5)) AS d(nombre, pmax)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.dimension_evaluacion de
    WHERE de.id_gestion = v_gestion AND de.nombre_dimension = d.nombre
  );

  -- Curso 2025: Tercero "A" - Mañana (profesor 1, aula 1)
  INSERT INTO public.curso (id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado)
  VALUES (18, 'A', 1, v_gestion, 1, 'Mañana', true)
  RETURNING id_curso INTO v_curso;

  -- Inscribir estudiantes en el curso
  FOREACH v_est IN ARRAY v_estudiantes LOOP
    INSERT INTO public.inscripcion (id_estudiante, id_curso, fecha_inscripcion, estado)
    VALUES (v_est, v_curso, DATE '2025-02-03', 'inscrito');
  END LOOP;

  -- Materias del curso + actividades (por dimension y trimestre) + calificaciones
  FOREACH v_mat IN ARRAY v_materias LOOP
    INSERT INTO public.curso_materia (id_curso, id_materia, id_profesor)
    VALUES (v_curso, v_mat, 1)
    RETURNING id_curso_materia INTO v_cm;

    FOR v_tri IN 1..3 LOOP
      FOR v_dim IN
        SELECT id_dimension_eval, nombre_dimension, puntaje_maximo
        FROM public.dimension_evaluacion
        WHERE id_gestion = v_gestion
        ORDER BY id_dimension_eval
      LOOP
        INSERT INTO public.actividad_evaluacion
          (id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad)
        VALUES (v_cm, v_dim.id_dimension_eval, v_tri,
                'Eval ' || v_dim.nombre_dimension || ' T' || v_tri,
                DATE '2025-03-01' + ((v_tri - 1) * 90))
        RETURNING id_actividad INTO v_act;

        -- Una nota por estudiante (dentro del puntaje maximo de la dimension)
        FOREACH v_est IN ARRAY v_estudiantes LOOP
          v_nota := round((v_dim.puntaje_maximo * (0.70 + random() * 0.30))::numeric, 0);
          INSERT INTO public.calificacion (id_actividad, id_estudiante, nota, fecha_evaluacion)
          VALUES (v_act, v_est, v_nota, DATE '2025-03-10' + ((v_tri - 1) * 90));
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Gestion 2025 poblada: curso %, % estudiantes, % materias, notas T1-T3.',
    v_curso, array_length(v_estudiantes, 1), array_length(v_materias, 1);
END $$;



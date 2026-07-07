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

--
-- PostgreSQL database dump
--

\restrict d5za3Ym3xUPfARZRXSnZgpoT19caZLQ6Orx3WJvx5hjqqtb5m7jd8OYkeZel0cC

-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

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

ALTER TABLE IF EXISTS ONLY public.usuario DROP CONSTRAINT IF EXISTS usuario_id_rol_fkey;
ALTER TABLE IF EXISTS ONLY public.tutor_estudiante DROP CONSTRAINT IF EXISTS tutor_estudiante_id_tutor_fkey;
ALTER TABLE IF EXISTS ONLY public.tutor_estudiante DROP CONSTRAINT IF EXISTS tutor_estudiante_id_estudiante_fkey;
ALTER TABLE IF EXISTS ONLY public.rol_permiso DROP CONSTRAINT IF EXISTS rol_permiso_id_rol_fkey;
ALTER TABLE IF EXISTS ONLY public.rol_permiso DROP CONSTRAINT IF EXISTS rol_permiso_id_permiso_fkey;
ALTER TABLE IF EXISTS ONLY public.rol_funcionalidad DROP CONSTRAINT IF EXISTS rol_funcionalidad_id_rol_fkey;
ALTER TABLE IF EXISTS ONLY public.rol_funcionalidad DROP CONSTRAINT IF EXISTS rol_funcionalidad_id_funcionalidad_fkey;
ALTER TABLE IF EXISTS ONLY public.profesor DROP CONSTRAINT IF EXISTS profesor_id_usuario_fkey;
ALTER TABLE IF EXISTS ONLY public.pago DROP CONSTRAINT IF EXISTS pago_id_usuario_registro_fkey;
ALTER TABLE IF EXISTS ONLY public.pago DROP CONSTRAINT IF EXISTS pago_id_estudiante_fkey;
ALTER TABLE IF EXISTS ONLY public.pago DROP CONSTRAINT IF EXISTS pago_id_deuda_fkey;
ALTER TABLE IF EXISTS ONLY public.notificacion DROP CONSTRAINT IF EXISTS notificacion_id_tutor_fkey;
ALTER TABLE IF EXISTS ONLY public.notificacion DROP CONSTRAINT IF EXISTS notificacion_id_aviso_fkey;
ALTER TABLE IF EXISTS ONLY public.movimiento_inventario DROP CONSTRAINT IF EXISTS movimiento_inventario_id_usuario_fkey;
ALTER TABLE IF EXISTS ONLY public.movimiento_inventario DROP CONSTRAINT IF EXISTS movimiento_inventario_id_material_fkey;
ALTER TABLE IF EXISTS ONLY public.materia DROP CONSTRAINT IF EXISTS materia_id_campo_fkey;
ALTER TABLE IF EXISTS ONLY public.libreta_emitida DROP CONSTRAINT IF EXISTS libreta_emitida_id_usuario_aprobador_fkey;
ALTER TABLE IF EXISTS ONLY public.libreta_emitida DROP CONSTRAINT IF EXISTS libreta_emitida_id_gestion_fkey;
ALTER TABLE IF EXISTS ONLY public.libreta_emitida DROP CONSTRAINT IF EXISTS libreta_emitida_id_estudiante_fkey;
ALTER TABLE IF EXISTS ONLY public.libreta_emitida DROP CONSTRAINT IF EXISTS libreta_emitida_id_curso_fkey;
ALTER TABLE IF EXISTS ONLY public.inscripcion DROP CONSTRAINT IF EXISTS inscripcion_id_estudiante_fkey;
ALTER TABLE IF EXISTS ONLY public.inscripcion DROP CONSTRAINT IF EXISTS inscripcion_id_curso_fkey;
ALTER TABLE IF EXISTS ONLY public.horario DROP CONSTRAINT IF EXISTS horario_id_materia_fkey;
ALTER TABLE IF EXISTS ONLY public.horario DROP CONSTRAINT IF EXISTS horario_id_curso_fkey;
ALTER TABLE IF EXISTS ONLY public.grado DROP CONSTRAINT IF EXISTS grado_id_nivel_fkey;
ALTER TABLE IF EXISTS ONLY public.funcionalidad DROP CONSTRAINT IF EXISTS funcionalidad_id_permiso_fkey;
ALTER TABLE IF EXISTS ONLY public.funcionalidad DROP CONSTRAINT IF EXISTS funcionalidad_id_modulo_fkey;
ALTER TABLE IF EXISTS ONLY public.entrega_estudiante DROP CONSTRAINT IF EXISTS entrega_estudiante_id_usuario_supervisor_fkey;
ALTER TABLE IF EXISTS ONLY public.entrega_estudiante DROP CONSTRAINT IF EXISTS entrega_estudiante_id_tutor_fkey;
ALTER TABLE IF EXISTS ONLY public.entrega_estudiante DROP CONSTRAINT IF EXISTS entrega_estudiante_id_estudiante_fkey;
ALTER TABLE IF EXISTS ONLY public.dimension_evaluacion DROP CONSTRAINT IF EXISTS dimension_evaluacion_id_gestion_fkey;
ALTER TABLE IF EXISTS ONLY public.deuda DROP CONSTRAINT IF EXISTS deuda_id_gestion_fkey;
ALTER TABLE IF EXISTS ONLY public.deuda DROP CONSTRAINT IF EXISTS deuda_id_estudiante_fkey;
ALTER TABLE IF EXISTS ONLY public.deuda DROP CONSTRAINT IF EXISTS deuda_id_concepto_fkey;
ALTER TABLE IF EXISTS ONLY public.curso_materia DROP CONSTRAINT IF EXISTS curso_materia_id_profesor_fkey;
ALTER TABLE IF EXISTS ONLY public.curso_materia DROP CONSTRAINT IF EXISTS curso_materia_id_materia_fkey;
ALTER TABLE IF EXISTS ONLY public.curso_materia DROP CONSTRAINT IF EXISTS curso_materia_id_curso_fkey;
ALTER TABLE IF EXISTS ONLY public.curso DROP CONSTRAINT IF EXISTS curso_id_profesor_fkey;
ALTER TABLE IF EXISTS ONLY public.curso DROP CONSTRAINT IF EXISTS curso_id_grado_fkey;
ALTER TABLE IF EXISTS ONLY public.curso DROP CONSTRAINT IF EXISTS curso_id_gestion_fkey;
ALTER TABLE IF EXISTS ONLY public.curso DROP CONSTRAINT IF EXISTS curso_id_aula_fkey;
ALTER TABLE IF EXISTS ONLY public.comprobante DROP CONSTRAINT IF EXISTS comprobante_id_pago_fkey;
ALTER TABLE IF EXISTS ONLY public.calificacion DROP CONSTRAINT IF EXISTS calificacion_id_estudiante_fkey;
ALTER TABLE IF EXISTS ONLY public.calificacion DROP CONSTRAINT IF EXISTS calificacion_id_actividad_fkey;
ALTER TABLE IF EXISTS ONLY public.bitacora DROP CONSTRAINT IF EXISTS bitacora_id_usuario_fkey;
ALTER TABLE IF EXISTS ONLY public.bitacora DROP CONSTRAINT IF EXISTS bitacora_id_modulo_fkey;
ALTER TABLE IF EXISTS ONLY public.bitacora DROP CONSTRAINT IF EXISTS bitacora_id_funcionalidad_fkey;
ALTER TABLE IF EXISTS ONLY public.aviso DROP CONSTRAINT IF EXISTS aviso_id_usuario_fkey;
ALTER TABLE IF EXISTS ONLY public.aviso DROP CONSTRAINT IF EXISTS aviso_id_curso_destino_fkey;
ALTER TABLE IF EXISTS ONLY public.asistencia DROP CONSTRAINT IF EXISTS asistencia_id_usuario_registro_fkey;
ALTER TABLE IF EXISTS ONLY public.asistencia DROP CONSTRAINT IF EXISTS asistencia_id_estudiante_fkey;
ALTER TABLE IF EXISTS ONLY public.asistencia DROP CONSTRAINT IF EXISTS asistencia_id_curso_fkey;
ALTER TABLE IF EXISTS ONLY public.actividad_evaluacion DROP CONSTRAINT IF EXISTS actividad_evaluacion_id_dimension_eval_fkey;
ALTER TABLE IF EXISTS ONLY public.actividad_evaluacion DROP CONSTRAINT IF EXISTS actividad_evaluacion_id_curso_materia_fkey;
DROP TRIGGER IF EXISTS trg_verificar_mora_al_generar_deuda ON public.deuda;
DROP TRIGGER IF EXISTS trg_validar_nota_maxima ON public.calificacion;
DROP TRIGGER IF EXISTS trg_validar_inscripcion_unica ON public.inscripcion;
DROP TRIGGER IF EXISTS trg_validar_entrega_autorizada ON public.entrega_estudiante;
DROP TRIGGER IF EXISTS trg_calcular_edad ON public.estudiante;
DROP TRIGGER IF EXISTS trg_bitacora_pago ON public.pago;
DROP TRIGGER IF EXISTS trg_bitacora_entrega ON public.entrega_estudiante;
DROP TRIGGER IF EXISTS trg_bitacora_asistencia ON public.asistencia;
DROP TRIGGER IF EXISTS trg_actualizar_stock ON public.movimiento_inventario;
DROP TRIGGER IF EXISTS trg_actualizar_deuda_al_pagar ON public.pago;
DROP INDEX IF EXISTS public.idx_usuario_rol;
DROP INDEX IF EXISTS public.idx_usuario_email_unique;
DROP INDEX IF EXISTS public.idx_pago_estudiante;
DROP INDEX IF EXISTS public.idx_pago_deuda;
DROP INDEX IF EXISTS public.idx_materia_campo;
DROP INDEX IF EXISTS public.idx_inscripcion_estudiante;
DROP INDEX IF EXISTS public.idx_inscripcion_curso;
DROP INDEX IF EXISTS public.idx_funcionalidad_permiso;
DROP INDEX IF EXISTS public.idx_funcionalidad_modulo;
DROP INDEX IF EXISTS public.idx_deuda_estudiante;
DROP INDEX IF EXISTS public.idx_deuda_estado;
DROP INDEX IF EXISTS public.idx_curso_grado;
DROP INDEX IF EXISTS public.idx_curso_gestion;
DROP INDEX IF EXISTS public.idx_calificacion_estudiante;
DROP INDEX IF EXISTS public.idx_calificacion_actividad;
DROP INDEX IF EXISTS public.idx_bitacora_usuario;
DROP INDEX IF EXISTS public.idx_bitacora_tabla;
DROP INDEX IF EXISTS public.idx_bitacora_fecha;
DROP INDEX IF EXISTS public.idx_asistencia_fecha;
DROP INDEX IF EXISTS public.idx_asistencia_estudiante;
ALTER TABLE IF EXISTS ONLY public.usuario DROP CONSTRAINT IF EXISTS usuario_username_key;
ALTER TABLE IF EXISTS ONLY public.usuario DROP CONSTRAINT IF EXISTS usuario_pkey;
ALTER TABLE IF EXISTS ONLY public.tutor DROP CONSTRAINT IF EXISTS tutor_pkey;
ALTER TABLE IF EXISTS ONLY public.tutor_estudiante DROP CONSTRAINT IF EXISTS tutor_estudiante_pkey;
ALTER TABLE IF EXISTS ONLY public.tutor_estudiante DROP CONSTRAINT IF EXISTS tutor_estudiante_id_tutor_id_estudiante_key;
ALTER TABLE IF EXISTS ONLY public.tutor DROP CONSTRAINT IF EXISTS tutor_ci_key;
ALTER TABLE IF EXISTS ONLY public.rol DROP CONSTRAINT IF EXISTS rol_pkey;
ALTER TABLE IF EXISTS ONLY public.rol_permiso DROP CONSTRAINT IF EXISTS rol_permiso_pkey;
ALTER TABLE IF EXISTS ONLY public.rol DROP CONSTRAINT IF EXISTS rol_nombre_rol_key;
ALTER TABLE IF EXISTS ONLY public.rol_funcionalidad DROP CONSTRAINT IF EXISTS rol_funcionalidad_pkey;
ALTER TABLE IF EXISTS ONLY public.profesor DROP CONSTRAINT IF EXISTS profesor_pkey;
ALTER TABLE IF EXISTS ONLY public.profesor DROP CONSTRAINT IF EXISTS profesor_id_usuario_key;
ALTER TABLE IF EXISTS ONLY public.profesor DROP CONSTRAINT IF EXISTS profesor_ci_key;
ALTER TABLE IF EXISTS ONLY public.permiso DROP CONSTRAINT IF EXISTS permiso_pkey;
ALTER TABLE IF EXISTS ONLY public.permiso DROP CONSTRAINT IF EXISTS permiso_nombre_permiso_key;
ALTER TABLE IF EXISTS ONLY public.pago DROP CONSTRAINT IF EXISTS pago_pkey;
ALTER TABLE IF EXISTS ONLY public.notificacion DROP CONSTRAINT IF EXISTS notificacion_pkey;
ALTER TABLE IF EXISTS ONLY public.nivel DROP CONSTRAINT IF EXISTS nivel_pkey;
ALTER TABLE IF EXISTS ONLY public.nivel DROP CONSTRAINT IF EXISTS nivel_nombre_nivel_key;
ALTER TABLE IF EXISTS ONLY public.movimiento_inventario DROP CONSTRAINT IF EXISTS movimiento_inventario_pkey;
ALTER TABLE IF EXISTS ONLY public.modulo DROP CONSTRAINT IF EXISTS modulo_pkey;
ALTER TABLE IF EXISTS ONLY public.modulo DROP CONSTRAINT IF EXISTS modulo_nombre_modulo_key;
ALTER TABLE IF EXISTS ONLY public.material DROP CONSTRAINT IF EXISTS material_pkey;
ALTER TABLE IF EXISTS ONLY public.materia DROP CONSTRAINT IF EXISTS materia_pkey;
ALTER TABLE IF EXISTS ONLY public.libreta_emitida DROP CONSTRAINT IF EXISTS libreta_emitida_pkey;
ALTER TABLE IF EXISTS ONLY public.libreta_emitida DROP CONSTRAINT IF EXISTS libreta_emitida_estudiante_curso_gestion_trimestre_key;
ALTER TABLE IF EXISTS ONLY public.inscripcion DROP CONSTRAINT IF EXISTS inscripcion_pkey;
ALTER TABLE IF EXISTS ONLY public.inscripcion DROP CONSTRAINT IF EXISTS inscripcion_id_estudiante_id_curso_key;
ALTER TABLE IF EXISTS ONLY public.horario DROP CONSTRAINT IF EXISTS horario_pkey;
ALTER TABLE IF EXISTS ONLY public.grado DROP CONSTRAINT IF EXISTS grado_pkey;
ALTER TABLE IF EXISTS ONLY public.grado DROP CONSTRAINT IF EXISTS grado_nombre_grado_id_nivel_key;
ALTER TABLE IF EXISTS ONLY public.gestion_academica DROP CONSTRAINT IF EXISTS gestion_academica_pkey;
ALTER TABLE IF EXISTS ONLY public.gestion_academica DROP CONSTRAINT IF EXISTS gestion_academica_anio_key;
ALTER TABLE IF EXISTS ONLY public.funcionalidad DROP CONSTRAINT IF EXISTS funcionalidad_pkey;
ALTER TABLE IF EXISTS ONLY public.funcionalidad DROP CONSTRAINT IF EXISTS funcionalidad_metodo_id_permiso_id_modulo_key;
ALTER TABLE IF EXISTS ONLY public.estudiante DROP CONSTRAINT IF EXISTS estudiante_pkey;
ALTER TABLE IF EXISTS ONLY public.estudiante DROP CONSTRAINT IF EXISTS estudiante_ci_key;
ALTER TABLE IF EXISTS ONLY public.entrega_estudiante DROP CONSTRAINT IF EXISTS entrega_estudiante_pkey;
ALTER TABLE IF EXISTS ONLY public.dimension_evaluacion DROP CONSTRAINT IF EXISTS dimension_evaluacion_pkey;
ALTER TABLE IF EXISTS ONLY public.dimension_evaluacion DROP CONSTRAINT IF EXISTS dimension_evaluacion_nombre_dimension_id_gestion_key;
ALTER TABLE IF EXISTS ONLY public.deuda DROP CONSTRAINT IF EXISTS deuda_pkey;
ALTER TABLE IF EXISTS ONLY public.deuda DROP CONSTRAINT IF EXISTS deuda_estudiante_gestion_concepto_mes_key;
ALTER TABLE IF EXISTS ONLY public.curso DROP CONSTRAINT IF EXISTS curso_pkey;
ALTER TABLE IF EXISTS ONLY public.curso_materia DROP CONSTRAINT IF EXISTS curso_materia_pkey;
ALTER TABLE IF EXISTS ONLY public.curso_materia DROP CONSTRAINT IF EXISTS curso_materia_id_curso_id_materia_key;
ALTER TABLE IF EXISTS ONLY public.curso DROP CONSTRAINT IF EXISTS curso_id_grado_paralelo_id_gestion_turno_key;
ALTER TABLE IF EXISTS ONLY public.concepto_pago DROP CONSTRAINT IF EXISTS concepto_pago_pkey;
ALTER TABLE IF EXISTS ONLY public.concepto_pago DROP CONSTRAINT IF EXISTS concepto_pago_nombre_concepto_key;
ALTER TABLE IF EXISTS ONLY public.comprobante DROP CONSTRAINT IF EXISTS comprobante_pkey;
ALTER TABLE IF EXISTS ONLY public.comprobante DROP CONSTRAINT IF EXISTS comprobante_numero_comprobante_key;
ALTER TABLE IF EXISTS ONLY public.comprobante DROP CONSTRAINT IF EXISTS comprobante_id_pago_key;
ALTER TABLE IF EXISTS ONLY public.campo_saber DROP CONSTRAINT IF EXISTS campo_saber_pkey;
ALTER TABLE IF EXISTS ONLY public.campo_saber DROP CONSTRAINT IF EXISTS campo_saber_orden_visualizacion_key;
ALTER TABLE IF EXISTS ONLY public.campo_saber DROP CONSTRAINT IF EXISTS campo_saber_nombre_campo_key;
ALTER TABLE IF EXISTS ONLY public.calificacion DROP CONSTRAINT IF EXISTS calificacion_pkey;
ALTER TABLE IF EXISTS ONLY public.calificacion DROP CONSTRAINT IF EXISTS calificacion_id_actividad_id_estudiante_key;
ALTER TABLE IF EXISTS ONLY public.bitacora DROP CONSTRAINT IF EXISTS bitacora_pkey;
ALTER TABLE IF EXISTS ONLY public.aviso DROP CONSTRAINT IF EXISTS aviso_pkey;
ALTER TABLE IF EXISTS ONLY public.aula DROP CONSTRAINT IF EXISTS aula_pkey;
ALTER TABLE IF EXISTS ONLY public.aula DROP CONSTRAINT IF EXISTS aula_numero_aula_key;
ALTER TABLE IF EXISTS ONLY public.asistencia DROP CONSTRAINT IF EXISTS asistencia_pkey;
ALTER TABLE IF EXISTS ONLY public.asistencia DROP CONSTRAINT IF EXISTS asistencia_id_estudiante_id_curso_fecha_key;
ALTER TABLE IF EXISTS ONLY public.actividad_evaluacion DROP CONSTRAINT IF EXISTS actividad_evaluacion_pkey;
ALTER TABLE IF EXISTS public.usuario ALTER COLUMN id_usuario DROP DEFAULT;
ALTER TABLE IF EXISTS public.tutor_estudiante ALTER COLUMN id_tutor_estudiante DROP DEFAULT;
ALTER TABLE IF EXISTS public.tutor ALTER COLUMN id_tutor DROP DEFAULT;
ALTER TABLE IF EXISTS public.rol ALTER COLUMN id_rol DROP DEFAULT;
ALTER TABLE IF EXISTS public.profesor ALTER COLUMN id_profesor DROP DEFAULT;
ALTER TABLE IF EXISTS public.permiso ALTER COLUMN id_permiso DROP DEFAULT;
ALTER TABLE IF EXISTS public.pago ALTER COLUMN id_pago DROP DEFAULT;
ALTER TABLE IF EXISTS public.notificacion ALTER COLUMN id_notificacion DROP DEFAULT;
ALTER TABLE IF EXISTS public.nivel ALTER COLUMN id_nivel DROP DEFAULT;
ALTER TABLE IF EXISTS public.movimiento_inventario ALTER COLUMN id_movimiento DROP DEFAULT;
ALTER TABLE IF EXISTS public.modulo ALTER COLUMN id_modulo DROP DEFAULT;
ALTER TABLE IF EXISTS public.material ALTER COLUMN id_material DROP DEFAULT;
ALTER TABLE IF EXISTS public.materia ALTER COLUMN id_materia DROP DEFAULT;
ALTER TABLE IF EXISTS public.libreta_emitida ALTER COLUMN id_libreta DROP DEFAULT;
ALTER TABLE IF EXISTS public.inscripcion ALTER COLUMN id_inscripcion DROP DEFAULT;
ALTER TABLE IF EXISTS public.horario ALTER COLUMN id_horario DROP DEFAULT;
ALTER TABLE IF EXISTS public.grado ALTER COLUMN id_grado DROP DEFAULT;
ALTER TABLE IF EXISTS public.gestion_academica ALTER COLUMN id_gestion DROP DEFAULT;
ALTER TABLE IF EXISTS public.funcionalidad ALTER COLUMN id_funcionalidad DROP DEFAULT;
ALTER TABLE IF EXISTS public.estudiante ALTER COLUMN id_estudiante DROP DEFAULT;
ALTER TABLE IF EXISTS public.entrega_estudiante ALTER COLUMN id_entrega DROP DEFAULT;
ALTER TABLE IF EXISTS public.dimension_evaluacion ALTER COLUMN id_dimension_eval DROP DEFAULT;
ALTER TABLE IF EXISTS public.deuda ALTER COLUMN id_deuda DROP DEFAULT;
ALTER TABLE IF EXISTS public.curso_materia ALTER COLUMN id_curso_materia DROP DEFAULT;
ALTER TABLE IF EXISTS public.curso ALTER COLUMN id_curso DROP DEFAULT;
ALTER TABLE IF EXISTS public.concepto_pago ALTER COLUMN id_concepto DROP DEFAULT;
ALTER TABLE IF EXISTS public.comprobante ALTER COLUMN id_comprobante DROP DEFAULT;
ALTER TABLE IF EXISTS public.campo_saber ALTER COLUMN id_campo DROP DEFAULT;
ALTER TABLE IF EXISTS public.calificacion ALTER COLUMN id_calificacion DROP DEFAULT;
ALTER TABLE IF EXISTS public.bitacora ALTER COLUMN id_bitacora DROP DEFAULT;
ALTER TABLE IF EXISTS public.aviso ALTER COLUMN id_aviso DROP DEFAULT;
ALTER TABLE IF EXISTS public.aula ALTER COLUMN id_aula DROP DEFAULT;
ALTER TABLE IF EXISTS public.asistencia ALTER COLUMN id_asistencia DROP DEFAULT;
ALTER TABLE IF EXISTS public.actividad_evaluacion ALTER COLUMN id_actividad DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.usuario_id_usuario_seq;
DROP TABLE IF EXISTS public.usuario;
DROP SEQUENCE IF EXISTS public.tutor_id_tutor_seq;
DROP SEQUENCE IF EXISTS public.tutor_estudiante_id_tutor_estudiante_seq;
DROP TABLE IF EXISTS public.tutor_estudiante;
DROP TABLE IF EXISTS public.tutor;
DROP TABLE IF EXISTS public.rol_permiso;
DROP SEQUENCE IF EXISTS public.rol_id_rol_seq;
DROP TABLE IF EXISTS public.rol_funcionalidad;
DROP TABLE IF EXISTS public.rol;
DROP SEQUENCE IF EXISTS public.profesor_id_profesor_seq;
DROP TABLE IF EXISTS public.profesor;
DROP SEQUENCE IF EXISTS public.permiso_id_permiso_seq;
DROP TABLE IF EXISTS public.permiso;
DROP SEQUENCE IF EXISTS public.pago_id_pago_seq;
DROP TABLE IF EXISTS public.pago;
DROP SEQUENCE IF EXISTS public.notificacion_id_notificacion_seq;
DROP TABLE IF EXISTS public.notificacion;
DROP SEQUENCE IF EXISTS public.nivel_id_nivel_seq;
DROP TABLE IF EXISTS public.nivel;
DROP SEQUENCE IF EXISTS public.movimiento_inventario_id_movimiento_seq;
DROP TABLE IF EXISTS public.movimiento_inventario;
DROP SEQUENCE IF EXISTS public.modulo_id_modulo_seq;
DROP TABLE IF EXISTS public.modulo;
DROP SEQUENCE IF EXISTS public.material_id_material_seq;
DROP TABLE IF EXISTS public.material;
DROP SEQUENCE IF EXISTS public.materia_id_materia_seq;
DROP TABLE IF EXISTS public.materia;
DROP SEQUENCE IF EXISTS public.libreta_emitida_id_libreta_seq;
DROP TABLE IF EXISTS public.libreta_emitida;
DROP SEQUENCE IF EXISTS public.inscripcion_id_inscripcion_seq;
DROP TABLE IF EXISTS public.inscripcion;
DROP SEQUENCE IF EXISTS public.horario_id_horario_seq;
DROP TABLE IF EXISTS public.horario;
DROP SEQUENCE IF EXISTS public.grado_id_grado_seq;
DROP TABLE IF EXISTS public.grado;
DROP SEQUENCE IF EXISTS public.gestion_academica_id_gestion_seq;
DROP TABLE IF EXISTS public.gestion_academica;
DROP SEQUENCE IF EXISTS public.funcionalidad_id_funcionalidad_seq;
DROP TABLE IF EXISTS public.funcionalidad;
DROP SEQUENCE IF EXISTS public.estudiante_id_estudiante_seq;
DROP TABLE IF EXISTS public.estudiante;
DROP SEQUENCE IF EXISTS public.entrega_estudiante_id_entrega_seq;
DROP TABLE IF EXISTS public.entrega_estudiante;
DROP SEQUENCE IF EXISTS public.dimension_evaluacion_id_dimension_eval_seq;
DROP TABLE IF EXISTS public.dimension_evaluacion;
DROP SEQUENCE IF EXISTS public.deuda_id_deuda_seq;
DROP TABLE IF EXISTS public.deuda;
DROP SEQUENCE IF EXISTS public.curso_materia_id_curso_materia_seq;
DROP TABLE IF EXISTS public.curso_materia;
DROP SEQUENCE IF EXISTS public.curso_id_curso_seq;
DROP TABLE IF EXISTS public.curso;
DROP SEQUENCE IF EXISTS public.concepto_pago_id_concepto_seq;
DROP TABLE IF EXISTS public.concepto_pago;
DROP SEQUENCE IF EXISTS public.comprobante_id_comprobante_seq;
DROP TABLE IF EXISTS public.comprobante;
DROP SEQUENCE IF EXISTS public.campo_saber_id_campo_seq;
DROP TABLE IF EXISTS public.campo_saber;
DROP SEQUENCE IF EXISTS public.calificacion_id_calificacion_seq;
DROP TABLE IF EXISTS public.calificacion;
DROP SEQUENCE IF EXISTS public.bitacora_id_bitacora_seq;
DROP TABLE IF EXISTS public.bitacora;
DROP SEQUENCE IF EXISTS public.aviso_id_aviso_seq;
DROP TABLE IF EXISTS public.aviso;
DROP SEQUENCE IF EXISTS public.aula_id_aula_seq;
DROP TABLE IF EXISTS public.aula;
DROP SEQUENCE IF EXISTS public.asistencia_id_asistencia_seq;
DROP TABLE IF EXISTS public.asistencia;
DROP SEQUENCE IF EXISTS public.actividad_evaluacion_id_actividad_seq;
DROP TABLE IF EXISTS public.actividad_evaluacion;
DROP FUNCTION IF EXISTS public.fn_validar_nota_maxima();
DROP FUNCTION IF EXISTS public.fn_validar_inscripcion_unica();
DROP FUNCTION IF EXISTS public.fn_validar_entrega_autorizada();
DROP FUNCTION IF EXISTS public.fn_marcar_deudas_en_mora();
DROP FUNCTION IF EXISTS public.fn_calcular_edad();
DROP FUNCTION IF EXISTS public.fn_bitacora_pago();
DROP FUNCTION IF EXISTS public.fn_bitacora_entrega();
DROP FUNCTION IF EXISTS public.fn_bitacora_asistencia();
DROP FUNCTION IF EXISTS public.fn_actualizar_stock();
DROP FUNCTION IF EXISTS public.fn_actualizar_deuda_al_pagar();
--
-- Name: fn_actualizar_deuda_al_pagar(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_actualizar_stock(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_bitacora_asistencia(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_bitacora_entrega(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_bitacora_pago(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_calcular_edad(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_marcar_deudas_en_mora(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_validar_entrega_autorizada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_validar_entrega_autorizada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_autorizado BOOLEAN;
BEGIN
    SELECT autorizado_recoger
    INTO v_autorizado
    FROM tutor_estudiante
    WHERE id_tutor = NEW.id_tutor
      AND id_estudiante = NEW.id_estudiante;

    IF v_autorizado IS NULL THEN
        NEW.observaciones := COALESCE(NEW.observaciones, '') ||
            ' [ALERTA: Tutor sin vínculo registrado]';
    ELSIF v_autorizado = FALSE THEN
        NEW.observaciones := COALESCE(NEW.observaciones, '') ||
            ' [ALERTA: Tutor no autorizado]';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: fn_validar_inscripcion_unica(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_validar_nota_maxima(); Type: FUNCTION; Schema: public; Owner: -
--

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

--
-- Name: actividad_evaluacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.actividad_evaluacion (
    id_actividad integer NOT NULL,
    id_curso_materia integer NOT NULL,
    id_dimension_eval integer NOT NULL,
    trimestre integer NOT NULL,
    nombre_actividad character varying(100) NOT NULL,
    fecha_actividad date,
    CONSTRAINT actividad_evaluacion_trimestre_check CHECK (((trimestre >= 1) AND (trimestre <= 3)))
);


--
-- Name: actividad_evaluacion_id_actividad_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.actividad_evaluacion_id_actividad_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actividad_evaluacion_id_actividad_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.actividad_evaluacion_id_actividad_seq OWNED BY public.actividad_evaluacion.id_actividad;


--
-- Name: asistencia; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: asistencia_id_asistencia_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asistencia_id_asistencia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asistencia_id_asistencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asistencia_id_asistencia_seq OWNED BY public.asistencia.id_asistencia;


--
-- Name: aula; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aula (
    id_aula integer NOT NULL,
    numero_aula character varying(20) NOT NULL,
    descripcion text,
    cantidad_mesas integer DEFAULT 0 NOT NULL,
    cantidad_sillas integer DEFAULT 0 NOT NULL,
    capacidad_estudiantes integer DEFAULT 0 NOT NULL
);


--
-- Name: aula_id_aula_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aula_id_aula_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aula_id_aula_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aula_id_aula_seq OWNED BY public.aula.id_aula;


--
-- Name: aviso; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: aviso_id_aviso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aviso_id_aviso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aviso_id_aviso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aviso_id_aviso_seq OWNED BY public.aviso.id_aviso;


--
-- Name: bitacora; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: bitacora_id_bitacora_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bitacora_id_bitacora_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bitacora_id_bitacora_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bitacora_id_bitacora_seq OWNED BY public.bitacora.id_bitacora;


--
-- Name: calificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calificacion (
    id_calificacion integer NOT NULL,
    id_actividad integer NOT NULL,
    id_estudiante integer NOT NULL,
    nota numeric(5,2) NOT NULL,
    fecha_evaluacion date DEFAULT CURRENT_DATE NOT NULL,
    observaciones text,
    CONSTRAINT calificacion_nota_check CHECK ((nota >= (0)::numeric))
);


--
-- Name: calificacion_id_calificacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calificacion_id_calificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calificacion_id_calificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calificacion_id_calificacion_seq OWNED BY public.calificacion.id_calificacion;


--
-- Name: campo_saber; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campo_saber (
    id_campo integer NOT NULL,
    nombre_campo character varying(100) NOT NULL,
    orden_visualizacion integer NOT NULL,
    descripcion text
);


--
-- Name: campo_saber_id_campo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campo_saber_id_campo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campo_saber_id_campo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campo_saber_id_campo_seq OWNED BY public.campo_saber.id_campo;


--
-- Name: comprobante; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comprobante (
    id_comprobante integer NOT NULL,
    id_pago integer NOT NULL,
    numero_comprobante character varying(50) NOT NULL,
    archivo_pdf_url character varying(255),
    fecha_emision timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: comprobante_id_comprobante_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comprobante_id_comprobante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comprobante_id_comprobante_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comprobante_id_comprobante_seq OWNED BY public.comprobante.id_comprobante;


--
-- Name: concepto_pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concepto_pago (
    id_concepto integer NOT NULL,
    nombre_concepto character varying(100) NOT NULL,
    descripcion text
);


--
-- Name: concepto_pago_id_concepto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.concepto_pago_id_concepto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: concepto_pago_id_concepto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.concepto_pago_id_concepto_seq OWNED BY public.concepto_pago.id_concepto;


--
-- Name: curso; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: curso_id_curso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.curso_id_curso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: curso_id_curso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.curso_id_curso_seq OWNED BY public.curso.id_curso;


--
-- Name: curso_materia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curso_materia (
    id_curso_materia integer NOT NULL,
    id_curso integer NOT NULL,
    id_materia integer NOT NULL,
    id_profesor integer NOT NULL
);


--
-- Name: curso_materia_id_curso_materia_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.curso_materia_id_curso_materia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: curso_materia_id_curso_materia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.curso_materia_id_curso_materia_seq OWNED BY public.curso_materia.id_curso_materia;


--
-- Name: deuda; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: deuda_id_deuda_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deuda_id_deuda_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deuda_id_deuda_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deuda_id_deuda_seq OWNED BY public.deuda.id_deuda;


--
-- Name: dimension_evaluacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dimension_evaluacion (
    id_dimension_eval integer NOT NULL,
    nombre_dimension character varying(30) NOT NULL,
    puntaje_maximo numeric(5,2) NOT NULL,
    id_gestion integer NOT NULL,
    CONSTRAINT dimension_evaluacion_nombre_dimension_check CHECK (((nombre_dimension)::text = ANY (ARRAY[('Ser'::character varying)::text, ('Saber'::character varying)::text, ('Hacer'::character varying)::text, ('Autoevaluacion'::character varying)::text])))
);


--
-- Name: dimension_evaluacion_id_dimension_eval_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dimension_evaluacion_id_dimension_eval_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dimension_evaluacion_id_dimension_eval_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dimension_evaluacion_id_dimension_eval_seq OWNED BY public.dimension_evaluacion.id_dimension_eval;


--
-- Name: entrega_estudiante; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entrega_estudiante (
    id_entrega integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_tutor integer NOT NULL,
    id_usuario_supervisor integer NOT NULL,
    fecha_hora_entrega timestamp without time zone DEFAULT now() NOT NULL,
    observaciones text
);


--
-- Name: entrega_estudiante_id_entrega_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entrega_estudiante_id_entrega_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entrega_estudiante_id_entrega_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entrega_estudiante_id_entrega_seq OWNED BY public.entrega_estudiante.id_entrega;


--
-- Name: estudiante; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT estudiante_estado_check CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying, 'retirado'::character varying, 'egresado'::character varying])::text[]))),
    CONSTRAINT estudiante_genero_check CHECK (((genero)::text = ANY (ARRAY[('Masculino'::character varying)::text, ('Femenino'::character varying)::text])))
);


--
-- Name: estudiante_id_estudiante_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estudiante_id_estudiante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estudiante_id_estudiante_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estudiante_id_estudiante_seq OWNED BY public.estudiante.id_estudiante;


--
-- Name: funcionalidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funcionalidad (
    id_funcionalidad integer NOT NULL,
    metodo character varying(50) NOT NULL,
    descripcion text,
    id_permiso integer NOT NULL,
    id_modulo integer NOT NULL,
    estado boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: funcionalidad_id_funcionalidad_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.funcionalidad_id_funcionalidad_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: funcionalidad_id_funcionalidad_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.funcionalidad_id_funcionalidad_seq OWNED BY public.funcionalidad.id_funcionalidad;


--
-- Name: gestion_academica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gestion_academica (
    id_gestion integer NOT NULL,
    anio integer NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    estado character varying(20) DEFAULT 'planificada'::character varying NOT NULL,
    CONSTRAINT gestion_academica_estado_check CHECK (((estado)::text = ANY (ARRAY[('planificada'::character varying)::text, ('activa'::character varying)::text, ('cerrada'::character varying)::text])))
);


--
-- Name: gestion_academica_id_gestion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gestion_academica_id_gestion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gestion_academica_id_gestion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gestion_academica_id_gestion_seq OWNED BY public.gestion_academica.id_gestion;


--
-- Name: grado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grado (
    id_grado integer NOT NULL,
    nombre_grado character varying(50) NOT NULL,
    id_nivel integer NOT NULL
);


--
-- Name: grado_id_grado_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grado_id_grado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grado_id_grado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grado_id_grado_seq OWNED BY public.grado.id_grado;


--
-- Name: horario; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: horario_id_horario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.horario_id_horario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: horario_id_horario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.horario_id_horario_seq OWNED BY public.horario.id_horario;


--
-- Name: inscripcion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inscripcion (
    id_inscripcion integer NOT NULL,
    id_estudiante integer NOT NULL,
    id_curso integer NOT NULL,
    fecha_inscripcion date DEFAULT CURRENT_DATE NOT NULL,
    estado character varying(20) DEFAULT 'inscrito'::character varying NOT NULL,
    observaciones text,
    CONSTRAINT inscripcion_estado_check CHECK (((estado)::text = ANY (ARRAY[('inscrito'::character varying)::text, ('retirado'::character varying)::text, ('trasladado'::character varying)::text])))
);


--
-- Name: inscripcion_id_inscripcion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inscripcion_id_inscripcion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inscripcion_id_inscripcion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inscripcion_id_inscripcion_seq OWNED BY public.inscripcion.id_inscripcion;


--
-- Name: libreta_emitida; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: libreta_emitida_id_libreta_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.libreta_emitida_id_libreta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: libreta_emitida_id_libreta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.libreta_emitida_id_libreta_seq OWNED BY public.libreta_emitida.id_libreta;


--
-- Name: materia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materia (
    id_materia integer NOT NULL,
    nombre_materia character varying(100) NOT NULL,
    descripcion text,
    id_campo integer NOT NULL,
    aplica_primaria boolean DEFAULT true NOT NULL,
    estado boolean DEFAULT true NOT NULL
);


--
-- Name: materia_id_materia_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.materia_id_materia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: materia_id_materia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.materia_id_materia_seq OWNED BY public.materia.id_materia;


--
-- Name: material; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: material_id_material_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.material_id_material_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: material_id_material_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.material_id_material_seq OWNED BY public.material.id_material;


--
-- Name: modulo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modulo (
    id_modulo integer NOT NULL,
    nombre_modulo character varying(80) NOT NULL,
    descripcion text,
    estado boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: modulo_id_modulo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.modulo_id_modulo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: modulo_id_modulo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.modulo_id_modulo_seq OWNED BY public.modulo.id_modulo;


--
-- Name: movimiento_inventario; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: movimiento_inventario_id_movimiento_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimiento_inventario_id_movimiento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimiento_inventario_id_movimiento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimiento_inventario_id_movimiento_seq OWNED BY public.movimiento_inventario.id_movimiento;


--
-- Name: nivel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nivel (
    id_nivel integer NOT NULL,
    nombre_nivel character varying(50) NOT NULL,
    monto_mensualidad numeric(10,2) DEFAULT 0 NOT NULL
);


--
-- Name: nivel_id_nivel_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nivel_id_nivel_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nivel_id_nivel_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nivel_id_nivel_seq OWNED BY public.nivel.id_nivel;


--
-- Name: notificacion; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notificacion_id_notificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notificacion_id_notificacion_seq OWNED BY public.notificacion.id_notificacion;


--
-- Name: pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pago (
    id_pago integer NOT NULL,
    id_deuda integer NOT NULL,
    id_estudiante integer NOT NULL,
    monto_pagado numeric(10,2) NOT NULL,
    metodo_pago character varying(30) NOT NULL,
    comprobante_url character varying(255),
    estado character varying(30) DEFAULT 'pendiente_validacion'::character varying NOT NULL,
    id_usuario_registro integer NOT NULL,
    fecha_pago timestamp without time zone DEFAULT now() NOT NULL,
    observaciones text,
    CONSTRAINT pago_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente_validacion'::character varying)::text, ('validado'::character varying)::text, ('rechazado'::character varying)::text]))),
    CONSTRAINT pago_metodo_pago_check CHECK (((metodo_pago)::text = ANY (ARRAY[('efectivo'::character varying)::text, ('QR'::character varying)::text, ('transferencia'::character varying)::text]))),
    CONSTRAINT pago_monto_pagado_check CHECK ((monto_pagado > (0)::numeric))
);


--
-- Name: pago_id_pago_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pago_id_pago_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pago_id_pago_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pago_id_pago_seq OWNED BY public.pago.id_pago;


--
-- Name: permiso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permiso (
    id_permiso integer NOT NULL,
    nombre_permiso character varying(100) NOT NULL,
    descripcion text
);


--
-- Name: permiso_id_permiso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permiso_id_permiso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permiso_id_permiso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permiso_id_permiso_seq OWNED BY public.permiso.id_permiso;


--
-- Name: profesor; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: profesor_id_profesor_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.profesor_id_profesor_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: profesor_id_profesor_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.profesor_id_profesor_seq OWNED BY public.profesor.id_profesor;


--
-- Name: rol; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rol (
    id_rol integer NOT NULL,
    nombre_rol character varying(50) NOT NULL,
    descripcion text,
    estado boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: rol_funcionalidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rol_funcionalidad (
    id_rol integer NOT NULL,
    id_funcionalidad integer NOT NULL,
    fecha_asignacion timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rol_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rol_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rol_id_rol_seq OWNED BY public.rol.id_rol;


--
-- Name: rol_permiso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rol_permiso (
    id_rol integer NOT NULL,
    id_permiso integer NOT NULL
);


--
-- Name: tutor; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: tutor_estudiante; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tutor_estudiante (
    id_tutor_estudiante integer NOT NULL,
    id_tutor integer NOT NULL,
    id_estudiante integer NOT NULL,
    parentesco character varying(30) NOT NULL,
    autorizado_recoger boolean DEFAULT true NOT NULL,
    contacto_emergencia boolean DEFAULT false NOT NULL
);


--
-- Name: tutor_estudiante_id_tutor_estudiante_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tutor_estudiante_id_tutor_estudiante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tutor_estudiante_id_tutor_estudiante_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tutor_estudiante_id_tutor_estudiante_seq OWNED BY public.tutor_estudiante.id_tutor_estudiante;


--
-- Name: tutor_id_tutor_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tutor_id_tutor_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tutor_id_tutor_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tutor_id_tutor_seq OWNED BY public.tutor.id_tutor;


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_id_usuario_seq OWNED BY public.usuario.id_usuario;


--
-- Name: actividad_evaluacion id_actividad; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad_evaluacion ALTER COLUMN id_actividad SET DEFAULT nextval('public.actividad_evaluacion_id_actividad_seq'::regclass);


--
-- Name: asistencia id_asistencia; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia ALTER COLUMN id_asistencia SET DEFAULT nextval('public.asistencia_id_asistencia_seq'::regclass);


--
-- Name: aula id_aula; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aula ALTER COLUMN id_aula SET DEFAULT nextval('public.aula_id_aula_seq'::regclass);


--
-- Name: aviso id_aviso; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso ALTER COLUMN id_aviso SET DEFAULT nextval('public.aviso_id_aviso_seq'::regclass);


--
-- Name: bitacora id_bitacora; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora ALTER COLUMN id_bitacora SET DEFAULT nextval('public.bitacora_id_bitacora_seq'::regclass);


--
-- Name: calificacion id_calificacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificacion ALTER COLUMN id_calificacion SET DEFAULT nextval('public.calificacion_id_calificacion_seq'::regclass);


--
-- Name: campo_saber id_campo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campo_saber ALTER COLUMN id_campo SET DEFAULT nextval('public.campo_saber_id_campo_seq'::regclass);


--
-- Name: comprobante id_comprobante; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante ALTER COLUMN id_comprobante SET DEFAULT nextval('public.comprobante_id_comprobante_seq'::regclass);


--
-- Name: concepto_pago id_concepto; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concepto_pago ALTER COLUMN id_concepto SET DEFAULT nextval('public.concepto_pago_id_concepto_seq'::regclass);


--
-- Name: curso id_curso; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso ALTER COLUMN id_curso SET DEFAULT nextval('public.curso_id_curso_seq'::regclass);


--
-- Name: curso_materia id_curso_materia; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_materia ALTER COLUMN id_curso_materia SET DEFAULT nextval('public.curso_materia_id_curso_materia_seq'::regclass);


--
-- Name: deuda id_deuda; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deuda ALTER COLUMN id_deuda SET DEFAULT nextval('public.deuda_id_deuda_seq'::regclass);


--
-- Name: dimension_evaluacion id_dimension_eval; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dimension_evaluacion ALTER COLUMN id_dimension_eval SET DEFAULT nextval('public.dimension_evaluacion_id_dimension_eval_seq'::regclass);


--
-- Name: entrega_estudiante id_entrega; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrega_estudiante ALTER COLUMN id_entrega SET DEFAULT nextval('public.entrega_estudiante_id_entrega_seq'::regclass);


--
-- Name: estudiante id_estudiante; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudiante ALTER COLUMN id_estudiante SET DEFAULT nextval('public.estudiante_id_estudiante_seq'::regclass);


--
-- Name: funcionalidad id_funcionalidad; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionalidad ALTER COLUMN id_funcionalidad SET DEFAULT nextval('public.funcionalidad_id_funcionalidad_seq'::regclass);


--
-- Name: gestion_academica id_gestion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gestion_academica ALTER COLUMN id_gestion SET DEFAULT nextval('public.gestion_academica_id_gestion_seq'::regclass);


--
-- Name: grado id_grado; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grado ALTER COLUMN id_grado SET DEFAULT nextval('public.grado_id_grado_seq'::regclass);


--
-- Name: horario id_horario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario ALTER COLUMN id_horario SET DEFAULT nextval('public.horario_id_horario_seq'::regclass);


--
-- Name: inscripcion id_inscripcion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripcion ALTER COLUMN id_inscripcion SET DEFAULT nextval('public.inscripcion_id_inscripcion_seq'::regclass);


--
-- Name: libreta_emitida id_libreta; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libreta_emitida ALTER COLUMN id_libreta SET DEFAULT nextval('public.libreta_emitida_id_libreta_seq'::regclass);


--
-- Name: materia id_materia; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materia ALTER COLUMN id_materia SET DEFAULT nextval('public.materia_id_materia_seq'::regclass);


--
-- Name: material id_material; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material ALTER COLUMN id_material SET DEFAULT nextval('public.material_id_material_seq'::regclass);


--
-- Name: modulo id_modulo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo ALTER COLUMN id_modulo SET DEFAULT nextval('public.modulo_id_modulo_seq'::regclass);


--
-- Name: movimiento_inventario id_movimiento; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_inventario ALTER COLUMN id_movimiento SET DEFAULT nextval('public.movimiento_inventario_id_movimiento_seq'::regclass);


--
-- Name: nivel id_nivel; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nivel ALTER COLUMN id_nivel SET DEFAULT nextval('public.nivel_id_nivel_seq'::regclass);


--
-- Name: notificacion id_notificacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion ALTER COLUMN id_notificacion SET DEFAULT nextval('public.notificacion_id_notificacion_seq'::regclass);


--
-- Name: pago id_pago; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago ALTER COLUMN id_pago SET DEFAULT nextval('public.pago_id_pago_seq'::regclass);


--
-- Name: permiso id_permiso; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permiso ALTER COLUMN id_permiso SET DEFAULT nextval('public.permiso_id_permiso_seq'::regclass);


--
-- Name: profesor id_profesor; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profesor ALTER COLUMN id_profesor SET DEFAULT nextval('public.profesor_id_profesor_seq'::regclass);


--
-- Name: rol id_rol; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol ALTER COLUMN id_rol SET DEFAULT nextval('public.rol_id_rol_seq'::regclass);


--
-- Name: tutor id_tutor; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor ALTER COLUMN id_tutor SET DEFAULT nextval('public.tutor_id_tutor_seq'::regclass);


--
-- Name: tutor_estudiante id_tutor_estudiante; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_estudiante ALTER COLUMN id_tutor_estudiante SET DEFAULT nextval('public.tutor_estudiante_id_tutor_estudiante_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuario_id_usuario_seq'::regclass);


--
-- Data for Name: actividad_evaluacion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.actividad_evaluacion (id_actividad, id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad) FROM stdin;
1	5	2	1	Practica demo de lectura	2026-04-15
2	30	1	1	Valoración actitudinal - Valores	2026-04-30
3	30	2	1	Evaluación valores comunitarios	2026-03-20
4	30	2	1	Evaluación convivencia y respeto	2026-04-15
5	30	3	1	Dramatización de valores	2026-03-27
6	30	3	1	Proyecto de solidaridad	2026-04-24
7	30	4	1	Autoevaluación - Valores T1	2026-04-30
8	28	1	1	Valoración actitudinal - CC.NN.	2026-04-30
9	28	2	1	Evaluación de seres vivos	2026-03-19
10	28	2	1	Evaluación del cuerpo humano	2026-04-16
11	28	3	1	Herbario con hojas del patio	2026-03-26
12	28	3	1	Maqueta del sistema digestivo	2026-04-23
13	28	4	1	Autoevaluación - CC.NN. T1	2026-04-30
14	25	1	1	Valoración actitudinal - Téc. Tecnológica	2026-04-30
15	25	2	1	Evaluación herramientas básicas	2026-03-21
16	25	2	1	Evaluación producción artesanal	2026-04-17
17	25	3	1	Construcción materiales reciclados	2026-03-28
18	25	3	1	Proyecto productivo: huerto escolar	2026-04-25
19	25	4	1	Autoevaluación - Téc. Tecnológica T1	2026-04-30
20	26	1	1	Valoración actitudinal - Matemática	2026-04-30
21	26	2	1	Examen números del 1 al 100	2026-03-17
22	26	2	1	Evaluación de sumas y restas	2026-04-14
23	26	3	1	Tarea problemas material concreto	2026-03-24
24	26	3	1	Proyecto de tiendita escolar	2026-04-21
25	26	4	1	Autoevaluación - Matemática T1	2026-04-30
26	18	1	1	Valoración actitudinal - Música	2026-04-30
27	18	2	1	Evaluación notas musicales básicas	2026-03-19
28	18	2	1	Evaluación de ritmo y compás	2026-04-16
29	18	3	1	Interpretación canción infantil	2026-03-26
30	18	3	1	Presentación grupal con instrumentos	2026-04-23
31	18	4	1	Autoevaluación - Música T1	2026-04-30
32	19	1	1	Valoración actitudinal - Ed. Física	2026-04-30
33	19	2	1	Evaluación teórica higiene corporal	2026-03-20
34	19	2	1	Evaluación reglas deportivas básicas	2026-04-15
35	19	3	1	Circuito habilidades motrices	2026-03-27
36	19	3	1	Mini torneo de relevos	2026-04-24
37	19	4	1	Autoevaluación - Ed. Física T1	2026-04-30
38	20	1	1	Valoración actitudinal - Artes	2026-04-30
39	20	2	1	Evaluación de colores y formas	2026-03-15
40	20	2	1	Evaluación de técnicas de pintura	2026-04-12
41	20	3	1	Pintura con témperas: paisaje	2026-03-22
42	20	3	1	Manualidad con material reciclado	2026-04-18
43	20	4	1	Autoevaluación - Artes T1	2026-04-30
44	21	1	1	Valoración actitudinal - CC.SS.	2026-04-30
45	21	2	1	Evaluación de comunidad y familia	2026-03-18
46	21	2	1	Evaluación de Bolivia y sus símbolos	2026-04-10
47	21	3	1	Maqueta de mi barrio	2026-03-28
48	21	3	1	Collage de fiestas bolivianas	2026-04-22
49	21	4	1	Autoevaluación - CC.SS. T1	2026-04-30
50	22	1	1	Valoración actitudinal - Lenguaje	2026-04-30
51	22	2	1	Examen de lectura comprensiva	2026-03-20
52	22	2	1	Evaluación de escritura creativa	2026-04-15
53	22	3	1	Tarea de caligrafía y dictado	2026-03-25
54	22	3	1	Proyecto de cuento ilustrado	2026-04-20
55	22	4	1	Autoevaluación - Lenguaje T1	2026-04-30
\.


--
-- Data for Name: asistencia; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.asistencia (id_asistencia, id_estudiante, id_curso, fecha, estado, observaciones, id_usuario_registro, fecha_registro) FROM stdin;
1	5	1	2026-05-04	J	Cita medica	4	2026-05-06 13:36:59.335787
2	1	2	2026-05-04	P	\N	4	2026-05-06 13:36:59.335787
3	2	2	2026-05-04	T	Llego 10 minutos tarde	4	2026-05-06 13:36:59.335787
4	3	3	2026-05-04	P	\N	4	2026-05-06 13:36:59.335787
5	4	3	2026-05-04	A	Sin justificativo	4	2026-05-06 13:36:59.335787
6	6	9	2026-03-23	P	\N	21	2026-05-06 21:47:58.580502
7	7	9	2026-03-23	P	\N	21	2026-05-06 21:47:58.580502
8	8	9	2026-03-23	P	\N	21	2026-05-06 21:47:58.580502
9	9	9	2026-03-23	P	\N	21	2026-05-06 21:47:58.580502
10	10	9	2026-03-23	P	\N	21	2026-05-06 21:47:58.580502
11	11	9	2026-03-23	P	\N	21	2026-05-06 21:47:58.580502
12	12	9	2026-03-23	P	\N	21	2026-05-06 21:47:58.580502
13	13	9	2026-03-23	P	\N	21	2026-05-06 21:47:58.580502
14	14	9	2026-03-23	P	\N	21	2026-05-06 21:47:58.580502
15	15	9	2026-03-23	P	\N	21	2026-05-06 21:47:58.580502
16	6	9	2026-03-24	P	\N	21	2026-05-06 21:47:58.580502
17	7	9	2026-03-24	P	\N	21	2026-05-06 21:47:58.580502
18	8	9	2026-03-24	P	\N	21	2026-05-06 21:47:58.580502
19	9	9	2026-03-24	P	\N	21	2026-05-06 21:47:58.580502
20	10	9	2026-03-24	P	\N	21	2026-05-06 21:47:58.580502
21	11	9	2026-03-24	T	\N	21	2026-05-06 21:47:58.580502
22	12	9	2026-03-24	P	\N	21	2026-05-06 21:47:58.580502
23	13	9	2026-03-24	A	\N	21	2026-05-06 21:47:58.580502
24	14	9	2026-03-24	P	\N	21	2026-05-06 21:47:58.580502
25	15	9	2026-03-24	P	\N	21	2026-05-06 21:47:58.580502
26	6	9	2026-03-25	P	\N	21	2026-05-06 21:47:58.580502
27	7	9	2026-03-25	P	\N	21	2026-05-06 21:47:58.580502
28	8	9	2026-03-25	P	\N	21	2026-05-06 21:47:58.580502
29	9	9	2026-03-25	A	\N	21	2026-05-06 21:47:58.580502
30	10	9	2026-03-25	P	\N	21	2026-05-06 21:47:58.580502
31	11	9	2026-03-25	P	\N	21	2026-05-06 21:47:58.580502
32	12	9	2026-03-25	P	\N	21	2026-05-06 21:47:58.580502
33	13	9	2026-03-25	A	\N	21	2026-05-06 21:47:58.580502
34	14	9	2026-03-25	P	\N	21	2026-05-06 21:47:58.580502
35	15	9	2026-03-25	P	\N	21	2026-05-06 21:47:58.580502
36	6	9	2026-03-26	P	\N	21	2026-05-06 21:47:58.580502
37	7	9	2026-03-26	P	\N	21	2026-05-06 21:47:58.580502
38	8	9	2026-03-26	P	\N	21	2026-05-06 21:47:58.580502
39	9	9	2026-03-26	P	\N	21	2026-05-06 21:47:58.580502
40	10	9	2026-03-26	P	\N	21	2026-05-06 21:47:58.580502
41	11	9	2026-03-26	P	\N	21	2026-05-06 21:47:58.580502
42	12	9	2026-03-26	P	\N	21	2026-05-06 21:47:58.580502
43	13	9	2026-03-26	A	\N	21	2026-05-06 21:47:58.580502
44	14	9	2026-03-26	P	\N	21	2026-05-06 21:47:58.580502
45	15	9	2026-03-26	P	\N	21	2026-05-06 21:47:58.580502
46	6	9	2026-03-27	P	\N	21	2026-05-06 21:47:58.580502
47	7	9	2026-03-27	P	\N	21	2026-05-06 21:47:58.580502
48	8	9	2026-03-27	P	\N	21	2026-05-06 21:47:58.580502
49	9	9	2026-03-27	P	\N	21	2026-05-06 21:47:58.580502
50	10	9	2026-03-27	P	\N	21	2026-05-06 21:47:58.580502
51	11	9	2026-03-27	P	\N	21	2026-05-06 21:47:58.580502
52	12	9	2026-03-27	P	\N	21	2026-05-06 21:47:58.580502
53	13	9	2026-03-27	P	\N	21	2026-05-06 21:47:58.580502
54	14	9	2026-03-27	J	\N	21	2026-05-06 21:47:58.580502
55	15	9	2026-03-27	P	\N	21	2026-05-06 21:47:58.580502
\.


--
-- Data for Name: aula; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.aula (id_aula, numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) FROM stdin;
1	A-101	Aula inicial con rincon de lectura	14	28	28
2	A-102	Aula primaria equipada	18	36	36
3	A-103	Aula primaria equipada	18	36	36
4	B-201	Aula secundaria	20	40	40
14	A-01	Planta baja ala sur	10	20	20
15	A-02	Planta baja ala sur	12	24	24
16	A-03	Planta baja ala norte	15	30	30
17	A-04	Planta baja ala norte	15	30	30
18	A-05	Primer piso ala sur	15	30	30
19	A-06	Primer piso ala sur	15	30	30
20	A-07	Primer piso ala norte	15	30	30
21	A-08	Primer piso ala norte	15	30	30
22	MULTI	Salón multiuso	0	0	80
\.


--
-- Data for Name: aviso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.aviso (id_aviso, titulo, contenido, id_usuario, destinatario_tipo, id_curso_destino, fecha_envio, estado) FROM stdin;
1	Reunion de padres demo	Se convoca a reunion informativa para revisar avance academico.	4	por_curso	2	2026-05-06 08:00:00	enviado
2	Reunión padres 1er trimestre	Se convoca a reunión para entrega de libretas viernes 15 mayo hrs 15:00.	16	por_curso	9	2026-05-05 10:00:00	enviado
3	Recordatorio pago marzo	Mensualidad marzo pendiente. Favor regularizar.	22	por_curso	9	2026-03-20 09:00:00	enviado
4	Feria educativa 2026	Feria Educativa sábado 20 junio.	16	todos	\N	2026-05-15 08:00:00	enviado
\.


--
-- Data for Name: bitacora; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bitacora (id_bitacora, id_usuario, id_modulo, id_funcionalidad, accion, tabla_afectada, id_registro_afectado, descripcion, fecha_hora, ip_origen) FROM stdin;
1	4	8	37	INSERT	asistencia	1	Se registró o actualizó asistencia estudiantil.	2026-05-06 13:36:59.335787	\N
2	4	8	37	INSERT	asistencia	2	Se registró o actualizó asistencia estudiantil.	2026-05-06 13:36:59.335787	\N
3	4	8	37	INSERT	asistencia	3	Se registró o actualizó asistencia estudiantil.	2026-05-06 13:36:59.335787	\N
4	4	8	37	INSERT	asistencia	4	Se registró o actualizó asistencia estudiantil.	2026-05-06 13:36:59.335787	\N
5	4	8	37	INSERT	asistencia	5	Se registró o actualizó asistencia estudiantil.	2026-05-06 13:36:59.335787	\N
6	4	10	40	INSERT	pago	1	Se registró o actualizó un pago en el sistema.	2026-05-06 13:36:59.335787	\N
7	4	10	40	INSERT	pago	2	Se registró o actualizó un pago en el sistema.	2026-05-06 13:36:59.335787	\N
8	1	3	11	LOGIN	usuario	1	Inicio de sesion de superuser	2026-05-06 14:14:15.821419	::ffff:127.0.0.1
9	1	3	11	LOGIN	usuario	1	Inicio de sesion de superuser	2026-05-06 18:47:07.732909	::ffff:127.0.0.1
10	21	8	37	INSERT	asistencia	6	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
11	21	8	37	INSERT	asistencia	7	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
12	21	8	37	INSERT	asistencia	8	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
13	21	8	37	INSERT	asistencia	9	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
14	21	8	37	INSERT	asistencia	10	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
15	21	8	37	INSERT	asistencia	11	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
16	21	8	37	INSERT	asistencia	12	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
17	21	8	37	INSERT	asistencia	13	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
18	21	8	37	INSERT	asistencia	14	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
19	21	8	37	INSERT	asistencia	15	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
20	21	8	37	INSERT	asistencia	16	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
21	21	8	37	INSERT	asistencia	17	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
22	21	8	37	INSERT	asistencia	18	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
23	21	8	37	INSERT	asistencia	19	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
24	21	8	37	INSERT	asistencia	20	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
25	21	8	37	INSERT	asistencia	21	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
26	21	8	37	INSERT	asistencia	22	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
27	21	8	37	INSERT	asistencia	23	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
28	21	8	37	INSERT	asistencia	24	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
29	21	8	37	INSERT	asistencia	25	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
30	21	8	37	INSERT	asistencia	26	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
31	21	8	37	INSERT	asistencia	27	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
32	21	8	37	INSERT	asistencia	28	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
33	21	8	37	INSERT	asistencia	29	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
34	21	8	37	INSERT	asistencia	30	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
35	21	8	37	INSERT	asistencia	31	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
36	21	8	37	INSERT	asistencia	32	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
37	21	8	37	INSERT	asistencia	33	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
38	21	8	37	INSERT	asistencia	34	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
39	21	8	37	INSERT	asistencia	35	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
40	21	8	37	INSERT	asistencia	36	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
41	21	8	37	INSERT	asistencia	37	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
42	21	8	37	INSERT	asistencia	38	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
43	21	8	37	INSERT	asistencia	39	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
44	21	8	37	INSERT	asistencia	40	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
45	21	8	37	INSERT	asistencia	41	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
46	21	8	37	INSERT	asistencia	42	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
47	21	8	37	INSERT	asistencia	43	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
48	21	8	37	INSERT	asistencia	44	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
49	21	8	37	INSERT	asistencia	45	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
50	21	8	37	INSERT	asistencia	46	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
51	21	8	37	INSERT	asistencia	47	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
52	21	8	37	INSERT	asistencia	48	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
53	21	8	37	INSERT	asistencia	49	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
54	21	8	37	INSERT	asistencia	50	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
55	21	8	37	INSERT	asistencia	51	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
56	21	8	37	INSERT	asistencia	52	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
57	21	8	37	INSERT	asistencia	53	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
58	21	8	37	INSERT	asistencia	54	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
59	21	8	37	INSERT	asistencia	55	Se registró o actualizó asistencia estudiantil.	2026-05-06 21:52:46.892993	\N
60	22	10	40	INSERT	pago	3	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
61	22	10	40	INSERT	pago	4	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
62	22	10	40	INSERT	pago	5	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
63	22	10	40	INSERT	pago	6	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
64	22	10	40	INSERT	pago	7	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
65	22	10	40	INSERT	pago	8	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
66	22	10	40	INSERT	pago	9	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
67	22	10	40	INSERT	pago	10	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
68	22	10	40	INSERT	pago	11	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
69	22	10	40	INSERT	pago	12	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
70	22	10	40	INSERT	pago	13	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
71	22	10	40	INSERT	pago	14	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
72	22	10	40	INSERT	pago	15	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
73	22	10	40	INSERT	pago	16	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
74	22	10	40	INSERT	pago	17	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
75	22	10	40	INSERT	pago	18	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
76	22	10	40	INSERT	pago	19	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
77	22	10	40	INSERT	pago	20	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
78	22	10	40	INSERT	pago	21	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
79	22	10	40	INSERT	pago	22	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
80	22	10	40	INSERT	pago	23	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
81	22	10	40	INSERT	pago	24	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
82	22	10	40	INSERT	pago	25	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
83	22	10	40	INSERT	pago	26	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
84	22	10	40	INSERT	pago	27	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
85	22	10	40	INSERT	pago	28	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
86	22	10	40	INSERT	pago	29	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
87	22	10	40	INSERT	pago	30	Se registró o actualizó un pago en el sistema.	2026-05-06 21:52:46.892993	\N
\.


--
-- Data for Name: calificacion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.calificacion (id_calificacion, id_actividad, id_estudiante, nota, fecha_evaluacion, observaciones) FROM stdin;
1	1	1	31.00	2026-04-16	Calificacion demo
2	1	2	28.00	2026-04-16	Calificacion demo
3	53	15	26.62	2026-03-25	\N
4	52	15	31.83	2026-04-15	\N
5	51	15	36.96	2026-03-20	\N
6	50	15	7.74	2026-04-30	\N
7	53	9	29.35	2026-03-25	\N
8	52	9	31.44	2026-04-15	\N
9	51	9	33.67	2026-03-20	\N
10	50	6	9.28	2026-04-30	\N
11	50	9	7.72	2026-04-30	\N
12	55	6	4.18	2026-04-30	\N
13	52	6	39.16	2026-04-15	\N
14	55	14	4.59	2026-04-30	\N
15	54	14	34.46	2026-04-20	\N
16	53	14	37.94	2026-03-25	\N
17	52	14	40.96	2026-04-15	\N
18	51	14	38.03	2026-03-20	\N
19	50	14	8.05	2026-04-30	\N
20	53	6	28.49	2026-03-25	\N
21	55	12	5.00	2026-04-30	\N
22	54	12	31.85	2026-04-20	\N
23	53	12	35.94	2026-03-25	\N
24	52	12	34.22	2026-04-15	\N
25	51	12	35.48	2026-03-20	\N
26	50	12	7.99	2026-04-30	\N
27	54	6	31.48	2026-04-20	\N
28	55	9	3.23	2026-04-30	\N
29	54	9	26.63	2026-04-20	\N
30	55	15	3.52	2026-04-30	\N
31	54	15	30.88	2026-04-20	\N
32	55	13	2.39	2026-04-30	\N
33	55	11	3.80	2026-04-30	\N
34	54	11	25.84	2026-04-20	\N
35	53	11	29.49	2026-03-25	\N
36	52	11	34.58	2026-04-15	\N
37	51	11	29.81	2026-03-20	\N
38	50	11	6.36	2026-04-30	\N
39	54	13	15.92	2026-04-20	\N
40	53	13	14.30	2026-03-25	\N
41	52	13	19.11	2026-04-15	\N
42	51	13	21.13	2026-03-20	\N
43	50	13	4.05	2026-04-30	\N
44	50	7	7.24	2026-04-30	\N
45	55	10	4.14	2026-04-30	\N
46	54	10	32.16	2026-04-20	\N
47	53	10	30.63	2026-03-25	\N
48	52	10	32.76	2026-04-15	\N
49	51	10	31.81	2026-03-20	\N
50	50	10	8.23	2026-04-30	\N
51	50	8	7.72	2026-04-30	\N
52	51	8	45.00	2026-03-20	\N
53	52	8	39.47	2026-04-15	\N
54	53	8	39.24	2026-03-25	\N
55	54	8	34.44	2026-04-20	\N
56	55	8	3.85	2026-04-30	\N
57	51	7	28.80	2026-03-20	\N
58	52	7	36.03	2026-04-15	\N
59	53	7	30.20	2026-03-25	\N
60	54	7	28.88	2026-04-20	\N
61	55	7	4.31	2026-04-30	\N
62	51	6	36.18	2026-03-20	\N
63	49	8	5.00	2026-04-30	\N
64	44	6	7.77	2026-04-30	\N
65	49	9	3.01	2026-04-30	\N
66	48	9	27.25	2026-04-22	\N
67	47	9	24.69	2026-03-28	\N
68	46	9	27.99	2026-04-10	\N
69	45	9	34.47	2026-03-18	\N
70	44	9	5.84	2026-04-30	\N
71	49	15	4.31	2026-04-30	\N
72	48	15	29.13	2026-04-22	\N
73	47	15	30.15	2026-03-28	\N
74	46	15	31.36	2026-04-10	\N
75	45	15	37.99	2026-03-18	\N
76	44	15	8.46	2026-04-30	\N
77	49	14	3.68	2026-04-30	\N
78	48	14	30.09	2026-04-22	\N
79	47	14	36.54	2026-03-28	\N
80	46	14	41.35	2026-04-10	\N
81	45	14	40.29	2026-03-18	\N
82	44	14	7.55	2026-04-30	\N
83	49	13	2.04	2026-04-30	\N
84	48	13	14.95	2026-04-22	\N
85	47	13	14.79	2026-03-28	\N
86	46	13	19.72	2026-04-10	\N
87	45	13	20.69	2026-03-18	\N
88	44	13	4.42	2026-04-30	\N
89	44	7	7.83	2026-04-30	\N
90	45	7	32.18	2026-03-18	\N
91	46	7	31.09	2026-04-10	\N
92	47	7	33.59	2026-03-28	\N
93	48	7	26.05	2026-04-22	\N
94	49	7	3.31	2026-04-30	\N
95	45	6	39.15	2026-03-18	\N
96	46	6	41.89	2026-04-10	\N
97	47	6	29.09	2026-03-28	\N
98	48	6	29.32	2026-04-22	\N
99	49	6	4.63	2026-04-30	\N
100	49	12	4.75	2026-04-30	\N
101	48	12	37.21	2026-04-22	\N
102	47	12	37.22	2026-03-28	\N
103	46	12	41.88	2026-04-10	\N
104	45	12	36.35	2026-03-18	\N
105	44	12	8.25	2026-04-30	\N
106	49	11	4.06	2026-04-30	\N
107	48	11	27.25	2026-04-22	\N
108	47	11	32.09	2026-03-28	\N
109	46	11	30.15	2026-04-10	\N
110	45	11	33.64	2026-03-18	\N
111	44	11	7.30	2026-04-30	\N
112	49	10	4.38	2026-04-30	\N
113	48	10	31.88	2026-04-22	\N
114	47	10	30.72	2026-03-28	\N
115	46	10	40.16	2026-04-10	\N
116	45	10	36.83	2026-03-18	\N
117	44	10	8.20	2026-04-30	\N
118	44	8	10.00	2026-04-30	\N
119	45	8	35.72	2026-03-18	\N
120	46	8	37.33	2026-04-10	\N
121	47	8	31.16	2026-03-28	\N
122	48	8	36.27	2026-04-22	\N
123	39	7	35.26	2026-03-15	\N
124	38	6	7.78	2026-04-30	\N
125	39	6	33.83	2026-03-15	\N
126	40	6	40.91	2026-04-12	\N
127	41	6	36.22	2026-03-22	\N
128	42	6	28.43	2026-04-18	\N
129	43	6	4.37	2026-04-30	\N
130	38	7	7.41	2026-04-30	\N
131	40	7	34.44	2026-04-12	\N
132	41	7	30.57	2026-03-22	\N
133	42	7	27.39	2026-04-18	\N
134	43	7	3.76	2026-04-30	\N
135	38	8	10.00	2026-04-30	\N
136	39	8	45.00	2026-03-15	\N
137	40	8	43.27	2026-04-12	\N
138	41	8	40.00	2026-03-22	\N
139	42	8	32.89	2026-04-18	\N
140	43	8	4.14	2026-04-30	\N
141	38	9	7.64	2026-04-30	\N
142	39	9	33.74	2026-03-15	\N
143	40	9	28.89	2026-04-12	\N
144	41	9	28.75	2026-03-22	\N
145	42	9	24.34	2026-04-18	\N
146	43	9	3.30	2026-04-30	\N
147	38	10	8.93	2026-04-30	\N
148	39	10	32.85	2026-03-15	\N
149	40	10	34.78	2026-04-12	\N
150	41	10	28.12	2026-03-22	\N
151	42	10	33.37	2026-04-18	\N
152	43	10	3.85	2026-04-30	\N
153	38	11	8.21	2026-04-30	\N
154	39	11	36.45	2026-03-15	\N
155	40	11	30.62	2026-04-12	\N
156	41	11	32.66	2026-03-22	\N
157	42	11	30.07	2026-04-18	\N
158	43	11	3.15	2026-04-30	\N
159	38	12	9.90	2026-04-30	\N
160	39	12	37.44	2026-03-15	\N
161	40	12	40.64	2026-04-12	\N
162	41	12	40.00	2026-03-22	\N
163	42	12	31.51	2026-04-18	\N
164	43	12	3.75	2026-04-30	\N
165	38	13	4.10	2026-04-30	\N
166	39	13	18.01	2026-03-15	\N
167	40	13	21.11	2026-04-12	\N
168	41	13	15.58	2026-03-22	\N
169	42	13	18.16	2026-04-18	\N
170	43	13	2.28	2026-04-30	\N
171	38	14	8.49	2026-04-30	\N
172	39	14	41.01	2026-03-15	\N
173	40	14	41.11	2026-04-12	\N
174	41	14	31.34	2026-03-22	\N
175	42	14	37.39	2026-04-18	\N
176	43	14	3.82	2026-04-30	\N
177	38	15	7.49	2026-04-30	\N
178	39	15	29.64	2026-03-15	\N
179	40	15	33.88	2026-04-12	\N
180	41	15	28.27	2026-03-22	\N
181	42	15	31.77	2026-04-18	\N
182	43	15	3.53	2026-04-30	\N
183	32	8	8.51	2026-04-30	\N
184	33	8	36.31	2026-03-20	\N
185	34	8	41.61	2026-04-15	\N
186	35	8	35.01	2026-03-27	\N
187	36	8	34.09	2026-04-24	\N
188	37	8	4.55	2026-04-30	\N
189	37	13	2.08	2026-04-30	\N
190	36	13	14.40	2026-04-24	\N
191	35	13	16.29	2026-03-27	\N
192	34	13	16.72	2026-04-15	\N
193	33	13	18.32	2026-03-20	\N
194	32	13	3.64	2026-04-30	\N
195	32	6	8.21	2026-04-30	\N
196	33	6	35.94	2026-03-20	\N
197	34	6	42.29	2026-04-15	\N
198	35	6	35.87	2026-03-27	\N
199	36	6	36.87	2026-04-24	\N
200	37	6	4.23	2026-04-30	\N
201	32	15	6.80	2026-04-30	\N
202	33	15	32.28	2026-03-20	\N
203	34	15	36.18	2026-04-15	\N
204	35	15	35.18	2026-03-27	\N
205	36	15	27.46	2026-04-24	\N
206	37	15	4.25	2026-04-30	\N
207	32	10	7.10	2026-04-30	\N
208	33	10	30.17	2026-03-20	\N
209	34	10	37.89	2026-04-15	\N
210	35	10	29.41	2026-03-27	\N
211	36	10	27.02	2026-04-24	\N
212	37	10	4.36	2026-04-30	\N
213	32	9	6.94	2026-04-30	\N
214	32	11	7.99	2026-04-30	\N
215	33	11	31.32	2026-03-20	\N
216	34	11	30.97	2026-04-15	\N
217	35	11	30.91	2026-03-27	\N
218	36	11	28.87	2026-04-24	\N
219	37	11	3.33	2026-04-30	\N
220	33	9	28.05	2026-03-20	\N
221	34	9	26.94	2026-04-15	\N
222	35	9	26.82	2026-03-27	\N
223	36	9	29.64	2026-04-24	\N
224	37	9	2.94	2026-04-30	\N
225	37	14	3.79	2026-04-30	\N
226	36	14	31.06	2026-04-24	\N
227	35	14	29.12	2026-03-27	\N
228	34	14	42.14	2026-04-15	\N
229	33	14	37.15	2026-03-20	\N
230	32	14	9.01	2026-04-30	\N
231	37	7	3.44	2026-04-30	\N
232	36	7	30.15	2026-04-24	\N
233	35	7	28.78	2026-03-27	\N
234	34	7	28.97	2026-04-15	\N
235	33	7	34.53	2026-03-20	\N
236	32	7	7.90	2026-04-30	\N
237	32	12	8.06	2026-04-30	\N
238	33	12	45.00	2026-03-20	\N
239	34	12	45.00	2026-04-15	\N
240	35	12	38.42	2026-03-27	\N
241	36	12	34.27	2026-04-24	\N
242	37	12	4.06	2026-04-30	\N
243	26	12	7.93	2026-04-30	\N
244	27	10	34.94	2026-03-19	\N
245	28	10	33.22	2026-04-16	\N
246	29	10	30.23	2026-03-26	\N
247	30	10	33.62	2026-04-23	\N
248	31	10	3.57	2026-04-30	\N
249	27	9	31.56	2026-03-19	\N
250	28	9	26.72	2026-04-16	\N
251	29	9	30.75	2026-03-26	\N
252	30	9	29.89	2026-04-23	\N
253	31	9	3.09	2026-04-30	\N
254	26	6	8.24	2026-04-30	\N
255	27	6	31.43	2026-03-19	\N
256	28	6	36.61	2026-04-16	\N
257	29	6	37.65	2026-03-26	\N
258	30	6	29.64	2026-04-23	\N
259	31	6	4.47	2026-04-30	\N
260	26	10	7.86	2026-04-30	\N
261	26	15	6.74	2026-04-30	\N
262	27	15	38.44	2026-03-19	\N
263	28	15	37.16	2026-04-16	\N
264	29	15	26.43	2026-03-26	\N
265	30	15	31.19	2026-04-23	\N
266	31	15	3.94	2026-04-30	\N
267	27	12	41.12	2026-03-19	\N
268	28	12	40.73	2026-04-16	\N
269	29	12	33.82	2026-03-26	\N
270	30	12	36.20	2026-04-23	\N
271	31	12	4.66	2026-04-30	\N
272	26	11	6.27	2026-04-30	\N
273	27	11	35.05	2026-03-19	\N
274	28	11	35.57	2026-04-16	\N
275	29	11	25.18	2026-03-26	\N
276	30	11	32.51	2026-04-23	\N
277	31	11	3.72	2026-04-30	\N
278	31	13	1.99	2026-04-30	\N
279	30	13	19.13	2026-04-23	\N
280	29	13	19.21	2026-03-26	\N
281	28	13	20.13	2026-04-16	\N
282	27	13	21.55	2026-03-19	\N
283	26	13	4.03	2026-04-30	\N
284	26	9	6.55	2026-04-30	\N
285	26	8	10.00	2026-04-30	\N
286	27	8	42.20	2026-03-19	\N
287	28	8	37.24	2026-04-16	\N
288	29	8	30.99	2026-03-26	\N
289	30	8	35.11	2026-04-23	\N
290	31	8	4.44	2026-04-30	\N
291	31	14	3.99	2026-04-30	\N
292	30	14	34.13	2026-04-23	\N
293	29	14	29.67	2026-03-26	\N
294	28	14	42.59	2026-04-16	\N
295	27	14	40.92	2026-03-19	\N
296	26	14	8.93	2026-04-30	\N
297	31	7	3.62	2026-04-30	\N
298	30	7	27.75	2026-04-23	\N
299	29	7	28.11	2026-03-26	\N
300	28	7	34.55	2026-04-16	\N
301	27	7	32.85	2026-03-19	\N
302	26	7	7.39	2026-04-30	\N
303	20	11	6.38	2026-04-30	\N
304	21	11	36.72	2026-03-17	\N
305	22	11	30.26	2026-04-14	\N
306	23	11	26.44	2026-03-24	\N
307	24	11	26.84	2026-04-21	\N
308	25	11	3.86	2026-04-30	\N
309	20	10	6.64	2026-04-30	\N
310	21	10	36.31	2026-03-17	\N
311	22	10	35.51	2026-04-14	\N
312	23	10	29.64	2026-03-24	\N
313	24	10	31.72	2026-04-21	\N
314	25	10	4.15	2026-04-30	\N
315	20	6	8.51	2026-04-30	\N
316	21	6	32.16	2026-03-17	\N
317	22	6	41.98	2026-04-14	\N
318	23	6	34.10	2026-03-24	\N
319	24	6	31.36	2026-04-21	\N
320	20	9	6.57	2026-04-30	\N
321	25	6	3.75	2026-04-30	\N
322	25	13	2.31	2026-04-30	\N
323	24	13	18.98	2026-04-21	\N
324	23	13	16.42	2026-03-24	\N
325	22	13	20.94	2026-04-14	\N
326	21	13	20.77	2026-03-17	\N
327	25	14	4.36	2026-04-30	\N
328	24	14	28.90	2026-04-21	\N
329	23	14	34.00	2026-03-24	\N
330	22	14	40.21	2026-04-14	\N
331	21	14	37.56	2026-03-17	\N
332	20	14	9.75	2026-04-30	\N
333	20	13	3.60	2026-04-30	\N
334	21	9	32.56	2026-03-17	\N
335	22	9	31.26	2026-04-14	\N
336	23	9	25.18	2026-03-24	\N
337	24	9	30.80	2026-04-21	\N
338	25	9	3.64	2026-04-30	\N
339	25	7	3.39	2026-04-30	\N
340	24	7	27.15	2026-04-21	\N
341	23	7	29.97	2026-03-24	\N
342	22	7	33.77	2026-04-14	\N
343	21	7	29.15	2026-03-17	\N
344	20	7	6.49	2026-04-30	\N
345	25	12	4.02	2026-04-30	\N
346	25	8	4.17	2026-04-30	\N
347	24	8	40.00	2026-04-21	\N
348	23	8	31.36	2026-03-24	\N
349	22	8	40.97	2026-04-14	\N
350	21	8	38.18	2026-03-17	\N
351	21	15	37.06	2026-03-17	\N
352	22	15	36.58	2026-04-14	\N
353	23	15	26.25	2026-03-24	\N
354	24	15	31.54	2026-04-21	\N
355	25	15	4.37	2026-04-30	\N
356	20	15	8.71	2026-04-30	\N
357	20	8	8.58	2026-04-30	\N
358	20	12	9.47	2026-04-30	\N
359	21	12	41.11	2026-03-17	\N
360	22	12	44.09	2026-04-14	\N
361	23	12	40.00	2026-03-24	\N
362	24	12	32.22	2026-04-21	\N
363	19	7	4.07	2026-04-30	\N
364	14	9	6.95	2026-04-30	\N
365	15	9	27.33	2026-03-21	\N
366	16	9	26.91	2026-04-17	\N
367	17	9	27.36	2026-03-28	\N
368	18	9	27.30	2026-04-25	\N
369	19	9	3.25	2026-04-30	\N
370	14	10	6.93	2026-04-30	\N
371	15	10	30.41	2026-03-21	\N
372	16	10	39.00	2026-04-17	\N
373	17	10	33.94	2026-03-28	\N
374	18	10	28.04	2026-04-25	\N
375	19	10	4.14	2026-04-30	\N
376	18	7	25.65	2026-04-25	\N
377	17	7	26.49	2026-03-28	\N
378	16	7	29.25	2026-04-17	\N
379	15	7	30.52	2026-03-21	\N
380	14	7	7.90	2026-04-30	\N
381	14	11	6.23	2026-04-30	\N
382	15	11	35.90	2026-03-21	\N
383	16	11	35.72	2026-04-17	\N
384	17	11	31.31	2026-03-28	\N
385	18	11	26.59	2026-04-25	\N
386	19	11	4.03	2026-04-30	\N
387	14	12	9.98	2026-04-30	\N
388	15	12	41.13	2026-03-21	\N
389	16	12	37.02	2026-04-17	\N
390	17	12	30.56	2026-03-28	\N
391	18	12	32.67	2026-04-25	\N
392	19	12	4.31	2026-04-30	\N
393	14	15	7.96	2026-04-30	\N
394	15	15	32.91	2026-03-21	\N
395	16	15	39.18	2026-04-17	\N
396	17	15	27.53	2026-03-28	\N
397	18	15	34.53	2026-04-25	\N
398	19	15	3.50	2026-04-30	\N
399	14	13	3.61	2026-04-30	\N
400	15	13	17.07	2026-03-21	\N
401	16	13	18.93	2026-04-17	\N
402	17	13	17.32	2026-03-28	\N
403	18	13	14.53	2026-04-25	\N
404	19	13	1.96	2026-04-30	\N
405	19	6	3.69	2026-04-30	\N
406	18	6	37.62	2026-04-25	\N
407	17	6	33.57	2026-03-28	\N
408	16	6	36.48	2026-04-17	\N
409	15	6	32.60	2026-03-21	\N
410	14	6	8.86	2026-04-30	\N
411	14	14	9.74	2026-04-30	\N
412	15	14	43.66	2026-03-21	\N
413	16	14	36.99	2026-04-17	\N
414	17	14	38.40	2026-03-28	\N
415	18	14	33.94	2026-04-25	\N
416	19	14	4.68	2026-04-30	\N
417	14	8	8.77	2026-04-30	\N
418	15	8	44.45	2026-03-21	\N
419	16	8	41.76	2026-04-17	\N
420	17	8	40.00	2026-03-28	\N
421	18	8	36.77	2026-04-25	\N
422	19	8	4.78	2026-04-30	\N
423	9	15	32.88	2026-03-19	\N
424	10	15	30.53	2026-04-16	\N
425	11	15	27.32	2026-03-26	\N
426	12	15	27.95	2026-04-23	\N
427	13	15	4.06	2026-04-30	\N
428	11	13	18.81	2026-03-26	\N
429	13	10	4.05	2026-04-30	\N
430	12	10	31.66	2026-04-23	\N
431	11	10	31.98	2026-03-26	\N
432	10	10	34.19	2026-04-16	\N
433	9	10	37.69	2026-03-19	\N
434	8	10	8.27	2026-04-30	\N
435	8	7	6.38	2026-04-30	\N
436	9	7	33.56	2026-03-19	\N
437	10	7	37.20	2026-04-16	\N
438	11	7	34.21	2026-03-26	\N
439	12	7	29.77	2026-04-23	\N
440	13	7	3.55	2026-04-30	\N
441	12	13	15.46	2026-04-23	\N
442	13	13	1.81	2026-04-30	\N
443	9	13	16.58	2026-03-19	\N
444	10	13	16.68	2026-04-16	\N
445	13	12	4.28	2026-04-30	\N
446	13	11	4.10	2026-04-30	\N
447	12	11	24.68	2026-04-23	\N
448	11	11	27.67	2026-03-26	\N
449	10	11	31.70	2026-04-16	\N
450	9	11	30.74	2026-03-19	\N
451	8	11	6.18	2026-04-30	\N
452	12	12	34.10	2026-04-23	\N
453	8	8	8.49	2026-04-30	\N
454	9	8	39.92	2026-03-19	\N
455	10	8	41.97	2026-04-16	\N
456	11	8	36.05	2026-03-26	\N
457	12	8	40.00	2026-04-23	\N
458	13	8	4.98	2026-04-30	\N
459	8	6	8.24	2026-04-30	\N
460	9	6	38.34	2026-03-19	\N
461	10	6	38.22	2026-04-16	\N
462	11	6	31.49	2026-03-26	\N
463	12	6	28.91	2026-04-23	\N
464	13	6	4.11	2026-04-30	\N
465	11	12	37.12	2026-03-26	\N
466	10	12	37.50	2026-04-16	\N
467	9	12	44.67	2026-03-19	\N
468	8	12	9.77	2026-04-30	\N
469	8	15	7.16	2026-04-30	\N
470	13	9	3.07	2026-04-30	\N
471	12	9	24.28	2026-04-23	\N
472	11	9	30.30	2026-03-26	\N
473	10	9	34.53	2026-04-16	\N
474	9	9	33.57	2026-03-19	\N
475	8	9	7.72	2026-04-30	\N
476	8	14	7.85	2026-04-30	\N
477	9	14	38.57	2026-03-19	\N
478	10	14	39.10	2026-04-16	\N
479	11	14	34.38	2026-03-26	\N
480	12	14	29.71	2026-04-23	\N
481	13	14	4.46	2026-04-30	\N
482	8	13	4.10	2026-04-30	\N
483	7	8	4.90	2026-04-30	\N
484	2	13	4.44	2026-04-30	\N
485	3	13	20.18	2026-03-20	\N
486	4	13	20.47	2026-04-15	\N
487	5	13	16.75	2026-03-27	\N
488	6	13	17.43	2026-04-24	\N
489	7	13	2.08	2026-04-30	\N
490	7	9	3.78	2026-04-30	\N
491	6	9	27.73	2026-04-24	\N
492	5	9	28.80	2026-03-27	\N
493	4	9	31.10	2026-04-15	\N
494	3	9	34.52	2026-03-20	\N
495	2	9	6.62	2026-04-30	\N
496	7	11	4.01	2026-04-30	\N
497	6	11	32.31	2026-04-24	\N
498	5	11	30.60	2026-03-27	\N
499	4	11	31.87	2026-04-15	\N
500	3	11	34.88	2026-03-20	\N
501	2	11	7.84	2026-04-30	\N
502	7	10	3.43	2026-04-30	\N
503	6	10	28.84	2026-04-24	\N
504	5	10	27.61	2026-03-27	\N
505	4	10	32.52	2026-04-15	\N
506	3	10	39.94	2026-03-20	\N
507	2	10	7.74	2026-04-30	\N
508	2	14	8.24	2026-04-30	\N
509	3	14	42.76	2026-03-20	\N
510	4	14	35.09	2026-04-15	\N
511	5	14	36.71	2026-03-27	\N
512	6	14	30.52	2026-04-24	\N
513	7	14	4.53	2026-04-30	\N
514	2	7	6.44	2026-04-30	\N
515	3	7	33.63	2026-03-20	\N
516	4	7	29.12	2026-04-15	\N
517	5	7	27.16	2026-03-27	\N
518	6	7	27.97	2026-04-24	\N
519	7	7	4.08	2026-04-30	\N
520	2	15	8.30	2026-04-30	\N
521	3	15	38.09	2026-03-20	\N
522	4	15	32.44	2026-04-15	\N
523	5	15	31.21	2026-03-27	\N
524	6	15	27.35	2026-04-24	\N
525	7	15	4.01	2026-04-30	\N
526	2	6	8.21	2026-04-30	\N
527	3	6	35.47	2026-03-20	\N
528	4	6	32.15	2026-04-15	\N
529	5	6	36.47	2026-03-27	\N
530	6	6	32.15	2026-04-24	\N
531	7	6	3.81	2026-04-30	\N
532	7	12	4.26	2026-04-30	\N
533	6	12	33.19	2026-04-24	\N
534	5	12	36.51	2026-03-27	\N
535	4	12	38.74	2026-04-15	\N
536	3	12	45.00	2026-03-20	\N
537	2	12	10.00	2026-04-30	\N
538	2	8	9.69	2026-04-30	\N
539	3	8	45.00	2026-03-20	\N
540	4	8	45.00	2026-04-15	\N
541	5	8	32.03	2026-03-27	\N
542	6	8	39.68	2026-04-24	\N
\.


--
-- Data for Name: campo_saber; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.campo_saber (id_campo, nombre_campo, orden_visualizacion, descripcion) FROM stdin;
1	Comunidad y Sociedad	1	Lenguajes, ciencias sociales y expresiones culturales
2	Ciencia Tecnologia y Produccion	2	Matematicas, tecnica y tecnologia
3	Vida Tierra Territorio	3	Ciencias naturales y cuidado del entorno
4	Cosmos y Pensamiento	4	Valores, espiritualidad y convivencia
7	Ciencia Tecnología y Producción	5	\N
\.


--
-- Data for Name: comprobante; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comprobante (id_comprobante, id_pago, numero_comprobante, archivo_pdf_url, fecha_emision) FROM stdin;
1	5	COMP-2026-00001	/recibos/COMP-2026-00001.pdf	2026-02-11 00:01:00
2	8	COMP-2026-00002	/recibos/COMP-2026-00002.pdf	2026-02-11 00:01:00
3	11	COMP-2026-00003	/recibos/COMP-2026-00003.pdf	2026-02-11 00:01:00
4	13	COMP-2026-00004	/recibos/COMP-2026-00004.pdf	2026-02-11 00:01:00
5	16	COMP-2026-00005	/recibos/COMP-2026-00005.pdf	2026-02-11 00:01:00
6	19	COMP-2026-00006	/recibos/COMP-2026-00006.pdf	2026-02-11 00:01:00
7	22	COMP-2026-00007	/recibos/COMP-2026-00007.pdf	2026-02-11 00:01:00
8	24	COMP-2026-00008	/recibos/COMP-2026-00008.pdf	2026-02-11 00:01:00
9	27	COMP-2026-00009	/recibos/COMP-2026-00009.pdf	2026-02-11 00:01:00
10	30	COMP-2026-00010	/recibos/COMP-2026-00010.pdf	2026-02-11 00:01:00
11	4	COMP-2026-00011	/recibos/COMP-2026-00011.pdf	2026-03-11 00:01:00
12	7	COMP-2026-00012	/recibos/COMP-2026-00012.pdf	2026-03-11 00:01:00
13	10	COMP-2026-00013	/recibos/COMP-2026-00013.pdf	2026-03-11 00:01:00
14	15	COMP-2026-00014	/recibos/COMP-2026-00014.pdf	2026-03-11 00:01:00
15	18	COMP-2026-00015	/recibos/COMP-2026-00015.pdf	2026-03-11 00:01:00
16	21	COMP-2026-00016	/recibos/COMP-2026-00016.pdf	2026-03-11 00:01:00
17	26	COMP-2026-00017	/recibos/COMP-2026-00017.pdf	2026-03-11 00:01:00
18	29	COMP-2026-00018	/recibos/COMP-2026-00018.pdf	2026-03-11 00:01:00
19	3	COMP-2026-00019	/recibos/COMP-2026-00019.pdf	2026-01-25 00:01:00
20	6	COMP-2026-00020	/recibos/COMP-2026-00020.pdf	2026-01-25 00:01:00
21	9	COMP-2026-00021	/recibos/COMP-2026-00021.pdf	2026-01-25 00:01:00
22	12	COMP-2026-00022	/recibos/COMP-2026-00022.pdf	2026-01-25 00:01:00
23	14	COMP-2026-00023	/recibos/COMP-2026-00023.pdf	2026-01-25 00:01:00
24	17	COMP-2026-00024	/recibos/COMP-2026-00024.pdf	2026-01-25 00:01:00
25	20	COMP-2026-00025	/recibos/COMP-2026-00025.pdf	2026-01-25 00:01:00
26	23	COMP-2026-00026	/recibos/COMP-2026-00026.pdf	2026-01-25 00:01:00
27	25	COMP-2026-00027	/recibos/COMP-2026-00027.pdf	2026-01-25 00:01:00
28	28	COMP-2026-00028	/recibos/COMP-2026-00028.pdf	2026-01-25 00:01:00
\.


--
-- Data for Name: concepto_pago; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.concepto_pago (id_concepto, nombre_concepto, descripcion) FROM stdin;
1	Inscripcion	Pago anual de inscripcion
4	Uniforme	Pago por uniforme institucional
2	Mensualidad	Pago mensual
10	Matrícula	Inscripción anual
3	Material escolar	Paquete de materiales
12	Seguro escolar	Seguro contra accidentes
\.


--
-- Data for Name: curso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.curso (id_curso, id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado) FROM stdin;
1	1	A	1	1	1	Tarde	t
2	3	A	2	1	1	Mañana	t
3	2	A	3	1	2	Mañana	t
4	15	A	21	1	16	Mañana	t
5	16	A	20	1	13	Mañana	t
6	17	A	19	1	12	Mañana	t
7	18	A	18	1	16	Mañana	t
8	19	A	17	1	13	Mañana	t
9	20	A	16	1	12	Mañana	t
10	14	A	15	1	18	Mañana	t
11	13	A	14	1	17	Mañana	t
\.


--
-- Data for Name: curso_materia; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.curso_materia (id_curso_materia, id_curso, id_materia, id_profesor) FROM stdin;
1	1	1	1
2	1	2	2
3	1	3	1
4	1	4	1
5	2	1	1
6	2	2	2
7	2	3	1
8	2	4	1
9	3	1	1
10	3	2	2
11	3	3	1
12	3	4	1
13	6	5	14
14	6	6	15
15	6	7	12
16	6	8	13
17	6	9	12
18	9	5	14
19	9	6	15
20	9	7	12
21	9	8	13
22	9	9	12
23	6	10	16
24	6	11	16
25	9	10	16
26	9	11	16
27	6	3	13
28	9	3	13
29	6	12	12
30	9	12	12
\.


--
-- Data for Name: deuda; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deuda (id_deuda, id_estudiante, id_gestion, id_concepto, monto, mes, estado, fecha_generacion) FROM stdin;
1	4	1	1	150.00	Febrero	mora	2026-05-06 13:36:59.335787
2	5	1	2	180.00	Mayo	pendiente	2026-05-06 13:36:59.335787
4	2	1	2	220.00	Mayo	pendiente	2026-05-06 13:36:59.335787
5	1	1	2	220.00	Mayo	pendiente	2026-05-06 13:36:59.335787
3	3	1	2	220.00	Abril	pagado	2026-05-06 13:36:59.335787
19	9	1	2	150.00	marzo	mora	2026-03-01 00:00:00
23	13	1	2	150.00	marzo	mora	2026-03-01 00:00:00
26	6	1	10	80.00	febrero	pagado	2026-01-15 00:00:00
16	6	1	2	150.00	marzo	pagado	2026-03-01 00:00:00
6	6	1	2	150.00	febrero	pagado	2026-02-01 00:00:00
27	7	1	10	80.00	febrero	pagado	2026-01-15 00:00:00
17	7	1	2	150.00	marzo	pagado	2026-03-01 00:00:00
7	7	1	2	150.00	febrero	pagado	2026-02-01 00:00:00
28	8	1	10	80.00	febrero	pagado	2026-01-15 00:00:00
18	8	1	2	150.00	marzo	pagado	2026-03-01 00:00:00
8	8	1	2	150.00	febrero	pagado	2026-02-01 00:00:00
29	9	1	10	80.00	febrero	pagado	2026-01-15 00:00:00
9	9	1	2	150.00	febrero	pagado	2026-02-01 00:00:00
30	10	1	10	80.00	febrero	pagado	2026-01-15 00:00:00
20	10	1	2	150.00	marzo	pagado	2026-03-01 00:00:00
10	10	1	2	150.00	febrero	pagado	2026-02-01 00:00:00
31	11	1	10	80.00	febrero	pagado	2026-01-15 00:00:00
21	11	1	2	150.00	marzo	pagado	2026-03-01 00:00:00
11	11	1	2	150.00	febrero	pagado	2026-02-01 00:00:00
32	12	1	10	80.00	febrero	pagado	2026-01-15 00:00:00
22	12	1	2	150.00	marzo	pagado	2026-03-01 00:00:00
12	12	1	2	150.00	febrero	pagado	2026-02-01 00:00:00
33	13	1	10	80.00	febrero	pagado	2026-01-15 00:00:00
13	13	1	2	150.00	febrero	pagado	2026-02-01 00:00:00
34	14	1	10	80.00	febrero	pagado	2026-01-15 00:00:00
24	14	1	2	150.00	marzo	pagado	2026-03-01 00:00:00
14	14	1	2	150.00	febrero	pagado	2026-02-01 00:00:00
35	15	1	10	80.00	febrero	pagado	2026-01-15 00:00:00
25	15	1	2	150.00	marzo	pagado	2026-03-01 00:00:00
15	15	1	2	150.00	febrero	pagado	2026-02-01 00:00:00
\.


--
-- Data for Name: dimension_evaluacion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dimension_evaluacion (id_dimension_eval, nombre_dimension, puntaje_maximo, id_gestion) FROM stdin;
1	Ser	10.00	1
2	Saber	45.00	1
3	Hacer	40.00	1
4	Autoevaluacion	5.00	1
\.


--
-- Data for Name: entrega_estudiante; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.entrega_estudiante (id_entrega, id_estudiante, id_tutor, id_usuario_supervisor, fecha_hora_entrega, observaciones) FROM stdin;
1	1	1	4	2026-05-04 12:20:00	Entrega demo autorizada
2	6	7	21	2026-03-23 11:30:00	Madre, CI verificado
3	7	8	21	2026-03-23 11:32:00	Padre
4	8	9	21	2026-03-23 11:35:00	Madre
5	9	11	21	2026-03-23 11:33:00	Madre
6	10	12	21	2026-03-23 11:40:00	Padre
7	11	13	21	2026-03-23 11:38:00	Madre
8	12	15	21	2026-03-23 11:36:00	Madre
9	13	16	21	2026-03-23 11:42:00	Padre
10	14	18	21	2026-03-23 11:45:00	Madre
11	15	20	21	2026-03-23 11:48:00	Madre
12	6	6	21	2026-03-24 11:30:00	Padre
13	8	9	21	2026-03-24 11:35:00	Madre
14	12	14	21	2026-03-24 11:36:00	Padre
15	7	21	21	2026-03-25 11:32:00	Tío NO autorizado - caso especial [ALERTA: Tutor no autorizado]
\.


--
-- Data for Name: estudiante; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.estudiante (id_estudiante, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado, fecha_registro, observaciones) FROM stdin;
1	Sofia	Mamani	EST-2001	2018-04-12	8	Femenino	activo	2026-05-06 13:36:59.335787	Demo: estudiante de primero A
2	Lucas	Flores	EST-2002	2018-09-03	7	Masculino	activo	2026-05-06 13:36:59.335787	Demo: estudiante de primero A
3	Camila	Vargas	EST-2003	2017-02-22	9	Femenino	activo	2026-05-06 13:36:59.335787	Demo: estudiante de segundo A
4	Diego	Choque	EST-2004	2017-07-18	8	Masculino	activo	2026-05-06 13:36:59.335787	Demo: estudiante de segundo A
5	Valentina	Cruz	EST-2005	2020-01-15	6	Femenino	activo	2026-05-06 13:36:59.335787	Demo: estudiante de kinder A
6	Uriel	Alvarado Cuellar	13456701	2019-03-15	7	Masculino	activo	2026-05-06 21:52:46.892993	\N
7	Victoria	Andreu Torrez	13456702	2019-06-22	6	Femenino	activo	2026-05-06 21:52:46.892993	\N
8	Louane Anthonella	Azenas Lopez	13456703	2019-01-10	7	Femenino	activo	2026-05-06 21:52:46.892993	\N
9	Jhuliane	Azurduy Cuellar	13456704	2019-08-05	6	Femenino	activo	2026-05-06 21:52:46.892993	\N
10	Matias	Castro Rojas	13456705	2019-04-18	7	Masculino	activo	2026-05-06 21:52:46.892993	\N
11	Felix Jassiel	Contreras Andrade	13456706	2019-11-30	6	Masculino	activo	2026-05-06 21:52:46.892993	\N
12	Isabel Valentina	Crespo Mallcu	13456707	2019-07-12	6	Femenino	activo	2026-05-06 21:52:46.892993	\N
13	Victoria	Cuellar Velazquez	13456708	2019-02-28	7	Femenino	activo	2026-05-06 21:52:46.892993	\N
14	Dulce Kamila	Espinosa Fuentes	13456709	2019-09-14	6	Femenino	activo	2026-05-06 21:52:46.892993	\N
15	Roshely Celeste	Farell Moya	13456710	2019-05-08	6	Femenino	activo	2026-05-06 21:52:46.892993	\N
\.


--
-- Data for Name: funcionalidad; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.funcionalidad (id_funcionalidad, metodo, descripcion, id_permiso, id_modulo, estado, fecha_creacion) FROM stdin;
1	GET /api/auth/me	Validar sesion	1	1	t	2026-05-06 13:36:59.1814
31	GET /api/estudiantes/*	Consultar estudiantes	11	6	t	2026-05-06 13:36:59.1814
34	GET /api/expedientes/:id	Consultar expediente	14	7	t	2026-05-06 13:36:59.1814
2	GET /api/roles	Listar roles	3	2	t	2026-05-06 13:36:59.1814
3	POST /api/roles	Crear roles	3	2	t	2026-05-06 13:36:59.1814
4	DELETE /api/roles/:id	Eliminar roles	3	2	t	2026-05-06 13:36:59.1814
5	GET /api/users	Listar usuarios	2	2	t	2026-05-06 13:36:59.1814
6	POST /api/users	Crear usuarios	2	2	t	2026-05-06 13:36:59.1814
7	PUT /api/users/:id	Actualizar usuarios	2	2	t	2026-05-06 13:36:59.1814
8	DELETE /api/users/:id	Eliminar usuarios	2	2	t	2026-05-06 13:36:59.1814
9	GET /api/bitacora	Consultar bitacora	4	3	t	2026-05-06 13:36:59.1814
10	GET /api/bitacora/filtros	Consultar filtros de bitacora	4	3	t	2026-05-06 13:36:59.1814
11	POST /api/auth/login	Registrar inicio de sesion	4	3	t	2026-05-06 13:36:59.1814
12	POST /api/auth/logout	Registrar cierre de sesion	4	3	t	2026-05-06 13:36:59.1814
13	GET /api/seguridad/modulos-funcionalidades	Consultar modulos y funcionalidades	3	3	t	2026-05-06 13:36:59.1814
14	GET /api/estructura/*	Consultar estructura educativa	5	4	t	2026-05-06 13:36:59.1814
15	POST /api/estructura/*	Crear estructura educativa	5	4	t	2026-05-06 13:36:59.1814
16	PUT /api/estructura/*	Actualizar estructura educativa	5	4	t	2026-05-06 13:36:59.1814
17	GET /api/horarios/*	Consultar horarios	9	5	t	2026-05-06 13:36:59.1814
18	POST /api/horarios	Crear bloques de horario	9	5	t	2026-05-06 13:36:59.1814
19	PUT /api/horarios/:id	Editar bloques de horario	9	5	t	2026-05-06 13:36:59.1814
67	PUT /api/horarios/curso/:id_curso/publicar	Publicar horario	9	5	t	2026-05-06 13:36:59.257473
20	GET /api/materia-asig/*	Consultar asignaciones de materias	8	5	t	2026-05-06 13:36:59.1814
21	POST /api/materia-asig/*	Asignar materias a cursos	8	5	t	2026-05-06 13:36:59.1814
22	GET /api/materias/*	Consultar materias	7	5	t	2026-05-06 13:36:59.1814
23	POST /api/materias/*	Crear materias	7	5	t	2026-05-06 13:36:59.1814
24	GET /api/curso/*	Consultar cursos	6	5	t	2026-05-06 13:36:59.1814
25	POST /api/curso/*	Crear cursos	6	5	t	2026-05-06 13:36:59.1814
26	PUT /api/curso/*	Actualizar cursos	6	5	t	2026-05-06 13:36:59.1814
29	GET /api/tutores/*	Consultar tutores	12	6	t	2026-05-06 13:36:59.1814
30	POST /api/tutores	Registrar tutores	12	6	t	2026-05-06 13:36:59.1814
27	POST /api/inscripciones	Inscribir estudiantes	13	6	t	2026-05-06 13:36:59.1814
28	PUT /api/inscripciones/*	Retirar o trasladar estudiantes	13	6	t	2026-05-06 13:36:59.1814
79	GET /api/estudiantes/*	Consultar estudiantes	10	6	t	2026-05-06 13:36:59.257473
32	POST /api/estudiantes	Registrar estudiantes	10	6	t	2026-05-06 13:36:59.1814
33	PUT /api/estudiantes/:id	Actualizar estudiantes	10	6	t	2026-05-06 13:36:59.1814
35	GET /api/asistencias/cursos	Listar cursos para asistencia	16	8	t	2026-05-06 13:36:59.1814
36	GET /api/asistencias/curso/:id_curso	Consultar asistencia por curso y fecha	16	8	t	2026-05-06 13:36:59.1814
37	POST /api/asistencias/curso/:id_curso	Registrar asistencia por curso y fecha	15	8	t	2026-05-06 13:36:59.1814
38	GET /api/pagos/conceptos	Listar conceptos de pago	20	10	t	2026-05-06 13:36:59.1814
39	GET /api/pagos/deudas	Listar deudas y pagos	20	10	t	2026-05-06 13:36:59.1814
40	POST /api/pagos/conceptos	Crear conceptos de pago	19	10	t	2026-05-06 13:36:59.1814
41	POST /api/pagos/deudas	Generar deudas	19	10	t	2026-05-06 13:36:59.1814
42	POST /api/pagos	Registrar pagos	19	10	t	2026-05-06 13:36:59.1814
43	PUT /api/pagos/:id/estado	Validar o rechazar pagos	19	10	t	2026-05-06 13:36:59.1814
44	GET /api/inventario/materiales	Listar materiales	22	11	t	2026-05-06 13:36:59.1814
45	GET /api/inventario/movimientos	Listar movimientos de inventario	22	11	t	2026-05-06 13:36:59.1814
46	POST /api/inventario/materiales	Crear materiales	21	11	t	2026-05-06 13:36:59.1814
47	PUT /api/inventario/materiales/:id	Actualizar materiales	21	11	t	2026-05-06 13:36:59.1814
48	POST /api/inventario/movimientos	Registrar movimientos de inventario	21	11	t	2026-05-06 13:36:59.1814
82	GET /api/expedientes/:id_estudiante	Consultar expediente digital	14	7	t	2026-05-06 13:36:59.257473
\.


--
-- Data for Name: gestion_academica; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.gestion_academica (id_gestion, anio, fecha_inicio, fecha_fin, estado) FROM stdin;
2	2025	2025-02-03	2025-11-28	cerrada
1	2026	2026-02-02	2026-11-27	activa
\.


--
-- Data for Name: grado; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.grado (id_grado, nombre_grado, id_nivel) FROM stdin;
1	Kinder	1
2	2do Primaria	2
3	1ro Primaria	2
4	1ro Secundaria	3
13	Pre-Kínder	7
14	Kínder	8
15	Sexto	2
16	Quinto	2
17	Cuarto	2
18	Tercero	2
19	Segundo	2
20	Primero	2
\.


--
-- Data for Name: horario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.horario (id_horario, id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad, publicado) FROM stdin;
1	1	1	martes	14:00:00	14:45:00	Cuentos y canciones	t
2	1	4	lunes	14:00:00	14:45:00	Convivencia	t
3	2	1	lunes	08:00:00	08:45:00	Lectura guiada	t
4	2	2	lunes	08:45:00	09:30:00	Numeros y conteo	t
5	2	3	martes	08:00:00	08:45:00	El entorno	t
6	3	1	martes	08:45:00	09:30:00	Comprension lectora	t
7	3	2	lunes	08:00:00	08:45:00	Operaciones basicas	t
8	9	11	lunes	08:00:00	08:45:00	\N	t
9	9	9	lunes	08:45:00	09:30:00	\N	t
10	9	3	lunes	10:00:00	10:45:00	\N	t
11	9	7	lunes	10:45:00	11:30:00	\N	t
12	9	9	martes	08:00:00	08:45:00	\N	t
13	9	11	martes	08:45:00	09:30:00	\N	t
14	9	8	martes	10:00:00	10:45:00	\N	t
15	9	12	martes	10:45:00	11:30:00	\N	t
16	9	11	miercoles	08:00:00	08:45:00	\N	t
17	9	6	miercoles	08:45:00	09:30:00	\N	t
18	9	9	miercoles	10:00:00	10:45:00	\N	t
19	9	10	miercoles	10:45:00	11:30:00	\N	t
20	9	9	jueves	08:00:00	08:45:00	\N	t
21	9	11	jueves	08:45:00	09:30:00	\N	t
22	9	5	jueves	10:00:00	10:45:00	\N	t
23	9	3	jueves	10:45:00	11:30:00	\N	t
24	9	8	viernes	08:00:00	08:45:00	\N	t
25	9	11	viernes	08:45:00	09:30:00	\N	t
26	9	10	viernes	10:00:00	10:45:00	\N	t
27	9	6	viernes	10:45:00	11:30:00	\N	t
\.


--
-- Data for Name: inscripcion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inscripcion (id_inscripcion, id_estudiante, id_curso, fecha_inscripcion, estado, observaciones) FROM stdin;
1	5	1	2026-02-05	inscrito	Inscripcion demo 2026
2	1	2	2026-02-05	inscrito	Inscripcion demo 2026
3	2	2	2026-02-05	inscrito	Inscripcion demo 2026
4	3	3	2026-02-05	inscrito	Inscripcion demo 2026
5	4	3	2026-02-05	inscrito	Inscripcion demo 2026
6	6	9	2026-01-20	inscrito	\N
7	7	9	2026-01-21	inscrito	\N
8	8	9	2026-01-22	inscrito	\N
9	9	9	2026-01-22	inscrito	\N
10	10	9	2026-01-23	inscrito	\N
11	11	9	2026-01-23	inscrito	\N
12	12	9	2026-01-24	inscrito	\N
13	13	9	2026-01-24	inscrito	\N
14	14	9	2026-01-25	inscrito	\N
15	15	9	2026-01-25	inscrito	\N
\.


--
-- Data for Name: libreta_emitida; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.libreta_emitida (id_libreta, id_estudiante, id_curso, id_gestion, trimestre, estado, id_usuario_aprobador, fecha_aprobacion, fecha_entrega, archivo_pdf_url) FROM stdin;
1	15	9	1	1	entregada	16	2026-05-10 16:00:00	2026-05-12 09:30:00	/libretas/2026/T1/1A_est_010.pdf
2	14	9	1	1	entregada	16	2026-05-10 16:00:00	2026-05-12 09:30:00	/libretas/2026/T1/1A_est_009.pdf
3	13	9	1	1	entregada	16	2026-05-10 16:00:00	2026-05-12 09:30:00	/libretas/2026/T1/1A_est_008.pdf
4	12	9	1	1	entregada	16	2026-05-10 16:00:00	2026-05-12 09:30:00	/libretas/2026/T1/1A_est_007.pdf
5	11	9	1	1	entregada	16	2026-05-10 16:00:00	2026-05-12 09:30:00	/libretas/2026/T1/1A_est_006.pdf
6	10	9	1	1	entregada	16	2026-05-10 16:00:00	2026-05-12 09:30:00	/libretas/2026/T1/1A_est_005.pdf
7	9	9	1	1	entregada	16	2026-05-10 16:00:00	2026-05-12 09:30:00	/libretas/2026/T1/1A_est_004.pdf
8	8	9	1	1	entregada	16	2026-05-10 16:00:00	2026-05-12 09:30:00	/libretas/2026/T1/1A_est_003.pdf
9	7	9	1	1	entregada	16	2026-05-10 16:00:00	2026-05-12 09:30:00	/libretas/2026/T1/1A_est_002.pdf
10	6	9	1	1	entregada	16	2026-05-10 16:00:00	2026-05-12 09:30:00	/libretas/2026/T1/1A_est_001.pdf
\.


--
-- Data for Name: materia; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.materia (id_materia, nombre_materia, descripcion, id_campo, aplica_primaria, estado) FROM stdin;
1	Lenguaje	Lectura, escritura y comunicacion	1	t	t
2	Matematicas	Numeros, operaciones y resolucion de problemas	2	t	t
3	Ciencias Naturales	Observacion del entorno y vida saludable	3	t	t
4	Valores	Convivencia, responsabilidad y respeto	4	t	t
5	Educación Musical	Expresión musical e instrumentos	1	t	t
6	Educación Física y Deportes	Desarrollo físico y deportes	1	t	t
7	Artes Plásticas y Visuales	Expresión artística y manualidades	1	t	t
8	Ciencias Sociales	Historia, geografía y educación cívica	1	t	t
9	Lenguaje y Comunicación	Competencias comunicativas en castellano	1	t	t
10	Técnica Tecnológica	Herramientas tecnológicas y productivas	7	t	t
11	Matemática	Pensamiento lógico-matemático	7	t	t
12	Valores Espiritualidad y Religiones	Valores éticos y espiritualidad intercultural	4	t	t
\.


--
-- Data for Name: material; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.material (id_material, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado, fecha_registro) FROM stdin;
2	Lapices HB	Lapices de grafito para aula	Material escolar	250	100	t	2026-05-06 13:36:59.1814
3	Tizas blancas	Caja de tizas blancas	Material escolar	60	20	t	2026-05-06 13:36:59.1814
4	Sillas escolares	Mobiliario para aulas	Mobiliario	35	20	t	2026-05-06 13:36:59.1814
5	Mesas escolares	Mobiliario para aulas	Mobiliario	20	20	t	2026-05-06 13:36:59.1814
1	Cuadernos rayados 100 hojas	Cuadernos para uso escolar	Material escolar	108	50	t	2026-05-06 13:36:59.1814
8	Marcador de pizarra	Marcador borrable azul/negro	papelería	8	10	t	2026-05-06 21:52:46.892993
9	Resma papel carta	500 hojas bond	papelería	20	5	t	2026-05-06 21:52:46.892993
11	Cuerda para saltar	3 metros	deportes	15	5	t	2026-05-06 21:52:46.892993
12	Botiquín primeros auxilios	Kit completo	salud	2	2	t	2026-05-06 21:52:46.892993
13	Escoba	Fibra para limpieza	limpieza	8	3	t	2026-05-06 21:52:46.892993
14	Detergente 1kg	Polvo limpieza general	limpieza	10	3	t	2026-05-06 21:52:46.892993
6	Insignia escolar	Insignia metálica con logo	uniformes	45	10	t	2026-05-06 21:52:46.892993
7	Tiza blanca (caja)	Caja de 100 unidades	papelería	4	5	t	2026-05-06 21:52:46.892993
10	Balón de fútbol	N°4 para primaria	deportes	1	2	t	2026-05-06 21:52:46.892993
15	Flauta dulce	Soprano educación musical	instrumentos	20	5	t	2026-05-06 21:52:46.892993
\.


--
-- Data for Name: modulo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.modulo (id_modulo, nombre_modulo, descripcion, estado, fecha_creacion) FROM stdin;
1	general	Acceso general al sistema	t	2026-05-06 13:36:59.1814
9	evaluaciones	Evaluaciones y calificaciones	t	2026-05-06 13:36:59.1814
12	entregas	Entrega segura de estudiantes	t	2026-05-06 13:36:59.1814
13	comunicacion	Avisos y notificaciones	t	2026-05-06 13:36:59.1814
14	reportes	Reportes institucionales	t	2026-05-06 13:36:59.1814
2	usuarios	Gestion de usuarios, roles y permisos	t	2026-05-06 13:36:59.1814
3	seguridad	Auditoria, permisos y bitacora del sistema	t	2026-05-06 13:36:59.1814
4	estructura	Gestion de aulas, niveles y grados	t	2026-05-06 13:36:59.1814
5	academico	Gestion academica: cursos, materias y horarios	t	2026-05-06 13:36:59.1814
6	estudiantes	Gestion de estudiantes, tutores e inscripciones	t	2026-05-06 13:36:59.1814
7	expedientes	Consulta de expedientes digitales	t	2026-05-06 13:36:59.1814
8	asistencias	Control de asistencia estudiantil	t	2026-05-06 13:36:59.1814
10	pagos	Gestion financiera	t	2026-05-06 13:36:59.1814
11	inventario	Gestion de inventario	t	2026-05-06 13:36:59.1814
\.


--
-- Data for Name: movimiento_inventario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.movimiento_inventario (id_movimiento, id_material, tipo_movimiento, cantidad, fecha_movimiento, id_usuario, observaciones) FROM stdin;
1	1	entrada	120	2026-05-06 13:36:59.335787	4	Carga demo: cuadernos
2	2	entrada	250	2026-05-06 13:36:59.335787	4	Carga demo: lapices
3	3	entrada	60	2026-05-06 13:36:59.335787	4	Carga demo: tizas
4	4	entrada	35	2026-05-06 13:36:59.335787	4	Carga demo: sillas
5	5	entrada	20	2026-05-06 13:36:59.335787	4	Carga demo: mesas
6	1	salida	12	2026-05-06 13:36:59.335787	4	Entrega demo a 1ro A
7	6	entrada	50	2026-02-01 08:00:00	22	Compra inicio gestión
8	6	salida	5	2026-02-10 09:00:00	22	Entrega estudiantes nuevos
9	7	entrada	15	2026-02-01 08:00:00	22	Compra inicio gestión
10	7	salida	11	2026-03-15 10:00:00	22	Distribución a aulas
11	10	entrada	8	2026-02-01 08:00:00	22	Compra inicio gestión
12	10	salida	7	2026-03-01 11:00:00	22	Entrega Ed. Física
13	15	entrada	25	2026-02-01 08:00:00	22	Compra clase música
14	15	salida	5	2026-03-05 09:00:00	22	Préstamo estudiantes 1ro A
\.


--
-- Data for Name: nivel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.nivel (id_nivel, nombre_nivel, monto_mensualidad) FROM stdin;
1	Inicial	180.00
3	Secundaria	260.00
7	Pre-Kínder	100.00
8	Kínder	120.00
2	Primaria	150.00
\.


--
-- Data for Name: notificacion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notificacion (id_notificacion, id_aviso, id_tutor, canal, estado_envio, fecha_envio) FROM stdin;
1	1	1	whatsapp	enviado	2026-05-06 08:02:00
2	1	2	whatsapp	enviado	2026-05-06 08:02:00
3	2	6	whatsapp	enviado	2026-05-05 10:01:00
4	2	7	whatsapp	enviado	2026-05-05 10:01:00
5	2	8	whatsapp	enviado	2026-05-05 10:01:00
6	2	9	whatsapp	enviado	2026-05-05 10:01:00
7	3	10	whatsapp	enviado	2026-03-20 09:01:00
8	2	10	whatsapp	enviado	2026-05-05 10:01:00
9	3	11	whatsapp	enviado	2026-03-20 09:01:00
10	2	11	whatsapp	enviado	2026-05-05 10:01:00
11	2	12	whatsapp	enviado	2026-05-05 10:01:00
12	2	13	whatsapp	enviado	2026-05-05 10:01:00
13	2	14	whatsapp	enviado	2026-05-05 10:01:00
14	2	15	whatsapp	enviado	2026-05-05 10:01:00
15	3	16	whatsapp	enviado	2026-03-20 09:01:00
16	2	16	whatsapp	enviado	2026-05-05 10:01:00
17	2	17	whatsapp	enviado	2026-05-05 10:01:00
18	2	18	whatsapp	enviado	2026-05-05 10:01:00
19	2	19	whatsapp	enviado	2026-05-05 10:01:00
20	2	20	whatsapp	enviado	2026-05-05 10:01:00
21	2	21	whatsapp	enviado	2026-05-05 10:01:00
\.


--
-- Data for Name: pago; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pago (id_pago, id_deuda, id_estudiante, monto_pagado, metodo_pago, comprobante_url, estado, id_usuario_registro, fecha_pago, observaciones) FROM stdin;
1	3	3	220.00	efectivo	\N	validado	4	2026-05-04 10:15:00	Pago demo validado
2	4	2	100.00	QR	demo/qr-pendiente.png	pendiente_validacion	4	2026-05-05 09:30:00	Pago demo pendiente de validacion
3	26	6	80.00	efectivo	\N	validado	22	2026-01-25 00:00:00	\N
4	16	6	150.00	efectivo	\N	validado	22	2026-03-11 00:00:00	\N
5	6	6	150.00	efectivo	\N	validado	22	2026-02-11 00:00:00	\N
6	27	7	80.00	transferencia	\N	validado	22	2026-01-25 00:00:00	\N
7	17	7	150.00	transferencia	\N	validado	22	2026-03-11 00:00:00	\N
8	7	7	150.00	transferencia	\N	validado	22	2026-02-11 00:00:00	\N
9	28	8	80.00	QR	\N	validado	22	2026-01-25 00:00:00	\N
10	18	8	150.00	QR	\N	validado	22	2026-03-11 00:00:00	\N
11	8	8	150.00	QR	\N	validado	22	2026-02-11 00:00:00	\N
12	29	9	80.00	efectivo	\N	validado	22	2026-01-25 00:00:00	\N
13	9	9	150.00	efectivo	\N	validado	22	2026-02-11 00:00:00	\N
14	30	10	80.00	transferencia	\N	validado	22	2026-01-25 00:00:00	\N
15	20	10	150.00	transferencia	\N	validado	22	2026-03-11 00:00:00	\N
16	10	10	150.00	transferencia	\N	validado	22	2026-02-11 00:00:00	\N
17	31	11	80.00	QR	\N	validado	22	2026-01-25 00:00:00	\N
18	21	11	150.00	QR	\N	validado	22	2026-03-11 00:00:00	\N
19	11	11	150.00	QR	\N	validado	22	2026-02-11 00:00:00	\N
20	32	12	80.00	efectivo	\N	validado	22	2026-01-25 00:00:00	\N
21	22	12	150.00	efectivo	\N	validado	22	2026-03-11 00:00:00	\N
22	12	12	150.00	efectivo	\N	validado	22	2026-02-11 00:00:00	\N
23	33	13	80.00	transferencia	\N	validado	22	2026-01-25 00:00:00	\N
24	13	13	150.00	transferencia	\N	validado	22	2026-02-11 00:00:00	\N
25	34	14	80.00	QR	\N	validado	22	2026-01-25 00:00:00	\N
26	24	14	150.00	QR	\N	validado	22	2026-03-11 00:00:00	\N
27	14	14	150.00	QR	\N	validado	22	2026-02-11 00:00:00	\N
28	35	15	80.00	efectivo	\N	validado	22	2026-01-25 00:00:00	\N
29	25	15	150.00	efectivo	\N	validado	22	2026-03-11 00:00:00	\N
30	15	15	150.00	efectivo	\N	validado	22	2026-02-11 00:00:00	\N
\.


--
-- Data for Name: permiso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permiso (id_permiso, nombre_permiso, descripcion) FROM stdin;
6	gestionar_cursos	Crear, consultar y actualizar cursos
7	gestionar_materias	Crear, consultar y actualizar materias
8	asignar_materias	Asignar materias y profesores a cursos
9	gestionar_horarios	Crear, editar y publicar horarios
12	gestionar_tutores	Crear, consultar y actualizar tutores
14	consultar_expedientes	Consultar expedientes digitales de estudiantes
4	ver_bitacora	Consultar bitacora de auditoria del sistema
1	ver_dashboard	Ver panel principal
2	gestionar_usuarios	Crear y editar usuarios
3	gestionar_roles	Crear y modificar roles
11	ver_estudiantes	Consultar expedientes
10	gestionar_estudiantes	Registrar estudiantes
13	gestionar_inscripciones	Registrar inscripciones
16	ver_asistencias	Consultar asistencia
15	registrar_asistencia	Tomar asistencia
18	ver_evaluaciones	Consultar calificaciones
17	gestionar_evaluaciones	Crear actividades y notas
70	aprobar_libretas	Aprobar libretas electrónicas
20	ver_pagos	Consultar pagos
19	gestionar_pagos	Registrar pagos
22	ver_inventario	Consultar stock
21	gestionar_inventario	Registrar movimientos
25	publicar_avisos	Crear comunicados
24	ver_entregas	Consultar entregas
23	registrar_entregas	Registrar entregas
26	ver_reportes	Generar reportes
5	gestionar_estructura	Configurar estructura
\.


--
-- Data for Name: profesor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profesor (id_profesor, id_usuario, nombre, apellido, ci, profesion, genero, estado, fecha_registro) FROM stdin;
1	2	Maria	Quiroga	PROF-1001	Lic. Educacion Primaria	Femenino	t	2026-05-06 13:36:59.335787
2	3	Carlos	Rojas	PROF-1002	Lic. Matematicas	Masculino	t	2026-05-06 13:36:59.335787
11	16	Ana María	Torrez Salinas	4523178	Lic. en Administración Educativa	Femenino	t	2026-05-06 21:52:46.892993
12	21	María Elena	Quispe Mamani	6547832	Lic. en Educación Primaria	Femenino	t	2026-05-06 21:52:46.892993
13	20	Juan Carlos	Mamani Condori	5234876	Lic. en Ciencias de la Educación	Masculino	t	2026-05-06 21:52:46.892993
14	19	Carmen Rosa	Villca Paco	7123456	Lic. en Educación Musical	Femenino	t	2026-05-06 21:52:46.892993
15	18	Luis Fernando	Choque Ticona	6098234	Lic. en Educación Física	Masculino	t	2026-05-06 21:52:46.892993
16	17	Rosa	Flores Huanca	8234567	Lic. en Matemáticas	Femenino	t	2026-05-06 21:52:46.892993
17	24	Patricia	Mendoza Cruz	5567890	Técnico en Educación Inicial	Femenino	t	2026-05-06 21:52:46.892993
18	23	Sofía	Vargas Limachi	6678901	Técnico en Educación Inicial	Femenino	t	2026-05-06 21:52:46.892993
\.


--
-- Data for Name: rol; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rol (id_rol, nombre_rol, descripcion, estado, fecha_creacion) FROM stdin;
3	Profesor	Gestion de asistencias y evaluaciones	t	2026-05-06 13:36:59.1814
1	SuperUsuario	Acceso total al sistema	t	2026-05-06 13:36:59.1814
2	Director	Acceso a todos los módulos	t	2026-05-06 13:36:59.1814
12	Docente	Gestión de asistencias y evaluaciones	t	2026-05-06 21:52:46.892993
4	Administrativo	Gestión de pagos e inventario	t	2026-05-06 13:36:59.1814
14	Ayudante	Apoyo en aulas y entregas	t	2026-05-06 21:52:46.892993
\.


--
-- Data for Name: rol_funcionalidad; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rol_funcionalidad (id_rol, id_funcionalidad, fecha_asignacion) FROM stdin;
1	1	2026-05-06 13:36:59.1814
1	41	2026-05-06 13:36:59.1814
1	28	2026-05-06 13:36:59.1814
1	11	2026-05-06 13:36:59.1814
1	5	2026-05-06 13:36:59.1814
2	28	2026-05-06 13:36:59.1814
2	18	2026-05-06 13:36:59.1814
2	37	2026-05-06 13:36:59.1814
4	32	2026-05-06 13:36:59.1814
1	35	2026-05-06 13:36:59.1814
2	48	2026-05-06 13:36:59.1814
3	37	2026-05-06 13:36:59.1814
4	41	2026-05-06 13:36:59.1814
1	25	2026-05-06 13:36:59.1814
1	21	2026-05-06 13:36:59.1814
2	36	2026-05-06 13:36:59.1814
1	4	2026-05-06 13:36:59.1814
1	10	2026-05-06 13:36:59.1814
1	46	2026-05-06 13:36:59.1814
3	1	2026-05-06 13:36:59.1814
1	34	2026-05-06 13:36:59.1814
2	22	2026-05-06 13:36:59.1814
4	29	2026-05-06 13:36:59.1814
1	15	2026-05-06 13:36:59.1814
1	27	2026-05-06 13:36:59.1814
4	40	2026-05-06 13:36:59.1814
1	43	2026-05-06 13:36:59.1814
1	39	2026-05-06 13:36:59.1814
2	17	2026-05-06 13:36:59.1814
1	3	2026-05-06 13:36:59.1814
1	47	2026-05-06 13:36:59.1814
1	45	2026-05-06 13:36:59.1814
4	31	2026-05-06 13:36:59.1814
2	46	2026-05-06 13:36:59.1814
1	23	2026-05-06 13:36:59.1814
1	29	2026-05-06 13:36:59.1814
2	31	2026-05-06 13:36:59.1814
1	6	2026-05-06 13:36:59.1814
1	30	2026-05-06 13:36:59.1814
4	42	2026-05-06 13:36:59.1814
4	38	2026-05-06 13:36:59.1814
1	14	2026-05-06 13:36:59.1814
2	23	2026-05-06 13:36:59.1814
2	39	2026-05-06 13:36:59.1814
4	16	2026-05-06 13:36:59.1814
2	25	2026-05-06 13:36:59.1814
4	47	2026-05-06 13:36:59.1814
2	43	2026-05-06 13:36:59.1814
2	40	2026-05-06 13:36:59.1814
1	7	2026-05-06 13:36:59.1814
1	31	2026-05-06 13:36:59.1814
1	20	2026-05-06 13:36:59.1814
1	18	2026-05-06 13:36:59.1814
2	24	2026-05-06 13:36:59.1814
1	33	2026-05-06 13:36:59.1814
4	39	2026-05-06 13:36:59.1814
4	46	2026-05-06 13:36:59.1814
2	19	2026-05-06 13:36:59.1814
1	17	2026-05-06 13:36:59.1814
4	28	2026-05-06 13:36:59.1814
1	42	2026-05-06 13:36:59.1814
4	45	2026-05-06 13:36:59.1814
2	30	2026-05-06 13:36:59.1814
1	19	2026-05-06 13:36:59.1814
3	34	2026-05-06 13:36:59.1814
1	48	2026-05-06 13:36:59.1814
1	24	2026-05-06 13:36:59.1814
2	21	2026-05-06 13:36:59.1814
2	45	2026-05-06 13:36:59.1814
1	2	2026-05-06 13:36:59.1814
1	16	2026-05-06 13:36:59.1814
1	22	2026-05-06 13:36:59.1814
1	8	2026-05-06 13:36:59.1814
1	9	2026-05-06 13:36:59.1814
4	43	2026-05-06 13:36:59.1814
2	29	2026-05-06 13:36:59.1814
1	32	2026-05-06 13:36:59.1814
2	14	2026-05-06 13:36:59.1814
2	42	2026-05-06 13:36:59.1814
1	12	2026-05-06 13:36:59.1814
2	38	2026-05-06 13:36:59.1814
2	33	2026-05-06 13:36:59.1814
2	41	2026-05-06 13:36:59.1814
4	34	2026-05-06 13:36:59.1814
3	36	2026-05-06 13:36:59.1814
2	44	2026-05-06 13:36:59.1814
2	1	2026-05-06 13:36:59.1814
2	35	2026-05-06 13:36:59.1814
1	40	2026-05-06 13:36:59.1814
2	26	2026-05-06 13:36:59.1814
4	15	2026-05-06 13:36:59.1814
4	1	2026-05-06 13:36:59.1814
3	35	2026-05-06 13:36:59.1814
1	37	2026-05-06 13:36:59.1814
2	16	2026-05-06 13:36:59.1814
4	44	2026-05-06 13:36:59.1814
2	20	2026-05-06 13:36:59.1814
2	15	2026-05-06 13:36:59.1814
2	32	2026-05-06 13:36:59.1814
1	36	2026-05-06 13:36:59.1814
1	13	2026-05-06 13:36:59.1814
1	26	2026-05-06 13:36:59.1814
3	31	2026-05-06 13:36:59.1814
4	33	2026-05-06 13:36:59.1814
4	14	2026-05-06 13:36:59.1814
2	47	2026-05-06 13:36:59.1814
4	48	2026-05-06 13:36:59.1814
1	44	2026-05-06 13:36:59.1814
2	27	2026-05-06 13:36:59.1814
4	27	2026-05-06 13:36:59.1814
2	34	2026-05-06 13:36:59.1814
1	38	2026-05-06 13:36:59.1814
4	30	2026-05-06 13:36:59.1814
4	82	2026-05-06 13:36:59.257473
2	79	2026-05-06 13:36:59.257473
2	67	2026-05-06 13:36:59.257473
1	82	2026-05-06 13:36:59.257473
2	82	2026-05-06 13:36:59.257473
4	79	2026-05-06 13:36:59.257473
1	67	2026-05-06 13:36:59.257473
3	82	2026-05-06 13:36:59.257473
1	79	2026-05-06 13:36:59.257473
12	31	2026-05-06 21:52:46.892993
12	35	2026-05-06 21:52:46.892993
12	1	2026-05-06 21:52:46.892993
14	35	2026-05-06 21:52:46.892993
12	37	2026-05-06 21:52:46.892993
12	36	2026-05-06 21:52:46.892993
14	36	2026-05-06 21:52:46.892993
14	37	2026-05-06 21:52:46.892993
14	31	2026-05-06 21:52:46.892993
14	1	2026-05-06 21:52:46.892993
\.


--
-- Data for Name: rol_permiso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rol_permiso (id_rol, id_permiso) FROM stdin;
1	26
1	25
1	24
1	23
1	22
1	21
1	20
1	19
1	18
1	17
1	16
1	15
1	14
1	13
1	12
1	11
1	10
1	9
1	8
1	7
1	6
1	5
1	4
1	3
1	2
1	1
2	26
2	25
2	24
2	23
2	22
2	21
2	20
2	19
2	18
2	17
2	16
2	15
2	14
2	13
2	12
2	11
2	10
2	9
2	8
2	7
2	6
2	5
2	1
3	25
3	18
3	17
3	16
3	15
3	14
3	11
3	1
4	26
4	25
4	24
4	23
4	22
4	21
4	20
4	19
4	14
4	13
4	12
4	11
4	10
4	5
4	1
1	70
2	70
12	1
12	11
12	16
12	15
12	18
12	17
12	25
12	24
12	23
12	26
14	1
14	11
14	16
14	15
14	24
14	23
\.


--
-- Data for Name: tutor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tutor (id_tutor, nombre, apellido, ci, genero, telefono, correo_electronico, direccion, fecha_registro) FROM stdin;
1	Ana	Mamani	TUT-3001	Femenino	70010001	ana.mamani@local.test	Zona Central 123	2026-05-06 13:36:59.335787
2	Jorge	Flores	TUT-3002	Masculino	70010002	jorge.flores@local.test	Av. Libertad 45	2026-05-06 13:36:59.335787
3	Patricia	Vargas	TUT-3003	Femenino	70010003	patricia.vargas@local.test	Barrio Norte 89	2026-05-06 13:36:59.335787
4	Roberto	Choque	TUT-3004	Masculino	70010004	roberto.choque@local.test	Calle Comercio 77	2026-05-06 13:36:59.335787
5	Elena	Cruz	TUT-3005	Femenino	70010005	elena.cruz@local.test	Zona Sur 321	2026-05-06 13:36:59.335787
6	Roberto	Alvarado Mendoza	3456701	Masculino	78901234	ralvarado@gmail.com	B/ San Martín #120	2026-05-06 21:52:46.892993
7	Sandra	Cuellar Vaca	3456702	Femenino	78901235	scuellar@gmail.com	B/ San Martín #120	2026-05-06 21:52:46.892993
8	Miguel	Andreu Peña	3456703	Masculino	69012345	mandreu@gmail.com	Av. Cristo Redentor #340	2026-05-06 21:52:46.892993
9	Carla	Lopez Gutiérrez	3456704	Femenino	69012346	clopez@hotmail.com	B/ Los Olivos #55	2026-05-06 21:52:46.892993
10	Fernando	Azurduy Rojas	3456705	Masculino	72345678	fazurduy@gmail.com	Urb. El Recreo, Casa 12	2026-05-06 21:52:46.892993
11	Patricia	Cuellar Montaño	3456706	Femenino	72345679	pcuellar@gmail.com	Urb. El Recreo, Casa 12	2026-05-06 21:52:46.892993
12	David	Castro Guzmán	3456707	Masculino	75678901	dcastro@hotmail.com	Av. Busch #789	2026-05-06 21:52:46.892993
13	Claudia	Andrade Quiroga	3456708	Femenino	75678902	candrade@gmail.com	B/ Miraflores #45	2026-05-06 21:52:46.892993
14	Ricardo	Crespo Tapia	3456709	Masculino	68901234	rcrespo@gmail.com	Av. Santos Dumont #1200	2026-05-06 21:52:46.892993
15	Elena	Mallcu Ticona	3456710	Femenino	68901235	emallcu@gmail.com	Av. Santos Dumont #1200	2026-05-06 21:52:46.892993
16	Gonzalo	Cuellar Arce	3456711	Masculino	71234567	gcuellar@hotmail.com	B/ Urbari #78	2026-05-06 21:52:46.892993
17	Jorge	Espinosa Paz	3456712	Masculino	71234568	jespinosa@gmail.com	Av. Alemana #567	2026-05-06 21:52:46.892993
18	Mónica	Fuentes Rocha	3456713	Femenino	74567890	mfuentes@gmail.com	Av. Alemana #567	2026-05-06 21:52:46.892993
19	Diego	Farell Suárez	3456714	Masculino	74567891	dfarell@gmail.com	B/ Equipetrol Norte #34	2026-05-06 21:52:46.892993
20	Adriana	Moya Gutiérrez	3456715	Femenino	77890123	amoya@gmail.com	B/ Equipetrol Norte #34	2026-05-06 21:52:46.892993
21	Ramiro	Torrez Gutierrez	3456716	Masculino	76543210	rtorrez@gmail.com	Av. Banzer #890	2026-05-06 21:52:46.892993
\.


--
-- Data for Name: tutor_estudiante; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tutor_estudiante (id_tutor_estudiante, id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) FROM stdin;
1	1	1	Madre	t	t
2	2	2	Padre	t	t
3	3	3	Madre	t	t
4	4	4	Padre	t	t
5	5	5	Madre	t	t
6	6	6	padre	t	t
7	7	6	madre	t	t
8	8	7	padre	t	t
9	9	8	madre	t	t
10	10	9	padre	t	t
11	11	9	madre	t	t
12	12	10	padre	t	t
13	13	11	madre	t	t
14	14	12	padre	t	f
15	15	12	madre	t	t
16	16	13	padre	t	t
17	17	14	padre	t	t
18	18	14	madre	t	t
19	19	15	padre	t	f
20	20	15	madre	t	t
21	21	7	tio	f	f
\.


--
-- Data for Name: usuario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuario (id_usuario, username, password_hash, id_rol, estado, ultimo_acceso, fecha_creacion, email, intentos_fallidos, bloqueado_hasta, reset_token, reset_token_expira) FROM stdin;
2	prof_maria	$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy	3	t	\N	2026-05-06 13:36:59.335787	maria.quiroga@local.test	0	\N	\N	\N
3	prof_carlos	$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy	3	t	\N	2026-05-06 13:36:59.335787	carlos.rojas@local.test	0	\N	\N	\N
4	admin_demo	$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy	4	t	\N	2026-05-06 13:36:59.335787	admin.demo@local.test	0	\N	\N	\N
1	superuser	$2b$10$ozbyUS7L4A36HcnvDxzexuKX2YM1YDyQJt3xNraTyWW07Hkvz/VAy	1	t	2026-05-06 18:47:07.710523	2026-05-06 13:36:59.1814	superuser@local.test	0	\N	\N	\N
15	admin	$2b$10$xK3vR8YqN5mZ7wJ3pL9Ghe	1	t	2026-03-28 14:30:00	2026-05-06 21:52:46.892993	\N	0	\N	\N	\N
16	directora	$2b$10$aB1cD2eF3gH4iJ5kL6mN7o	2	t	2026-03-28 08:15:00	2026-05-06 21:52:46.892993	\N	0	\N	\N	\N
17	rflores	$2b$10$zA1bC2dE3fG4hI5jK6lM7n	12	t	2026-03-28 08:05:00	2026-05-06 21:52:46.892993	\N	0	\N	\N	\N
18	lchoque	$2b$10$xY9zA0bC1dE2fG3hI4jK5l	12	t	2026-03-26 16:00:00	2026-05-06 21:52:46.892993	\N	0	\N	\N	\N
19	cvillca	$2b$10$vW7xY8zA9bC0dE1fG2hI3j	12	t	2026-03-28 08:00:00	2026-05-06 21:52:46.892993	\N	0	\N	\N	\N
20	jmamani	$2b$10$tU5vW6xY7zA8bC9dE0fG1h	12	t	2026-03-27 15:00:00	2026-05-06 21:52:46.892993	\N	0	\N	\N	\N
21	mquispe	$2b$10$rS3tU4vW5xY6zA7bC8dE9f	12	t	2026-03-28 07:50:00	2026-05-06 21:52:46.892993	\N	0	\N	\N	\N
22	secretaria	$2b$10$bC3dE4fG5hI6jK7lM8nO9p	4	t	2026-03-28 08:00:00	2026-05-06 21:52:46.892993	\N	0	\N	\N	\N
23	ayudante2	$2b$10$fG7hI8jK9lM0nO1pQ2rS3t	14	t	2026-03-28 07:45:00	2026-05-06 21:52:46.892993	\N	0	\N	\N	\N
24	ayudante1	$2b$10$dE5fG6hI7jK8lM9nO0pQ1r	14	t	2026-03-28 07:45:00	2026-05-06 21:52:46.892993	\N	0	\N	\N	\N
\.


--
-- Name: actividad_evaluacion_id_actividad_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.actividad_evaluacion_id_actividad_seq', 55, true);


--
-- Name: asistencia_id_asistencia_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.asistencia_id_asistencia_seq', 55, true);


--
-- Name: aula_id_aula_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.aula_id_aula_seq', 22, true);


--
-- Name: aviso_id_aviso_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.aviso_id_aviso_seq', 4, true);


--
-- Name: bitacora_id_bitacora_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bitacora_id_bitacora_seq', 87, true);


--
-- Name: calificacion_id_calificacion_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.calificacion_id_calificacion_seq', 542, true);


--
-- Name: campo_saber_id_campo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.campo_saber_id_campo_seq', 7, true);


--
-- Name: comprobante_id_comprobante_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.comprobante_id_comprobante_seq', 28, true);


--
-- Name: concepto_pago_id_concepto_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.concepto_pago_id_concepto_seq', 12, true);


--
-- Name: curso_id_curso_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.curso_id_curso_seq', 11, true);


--
-- Name: curso_materia_id_curso_materia_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.curso_materia_id_curso_materia_seq', 30, true);


--
-- Name: deuda_id_deuda_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.deuda_id_deuda_seq', 35, true);


--
-- Name: dimension_evaluacion_id_dimension_eval_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dimension_evaluacion_id_dimension_eval_seq', 4, true);


--
-- Name: entrega_estudiante_id_entrega_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.entrega_estudiante_id_entrega_seq', 15, true);


--
-- Name: estudiante_id_estudiante_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.estudiante_id_estudiante_seq', 15, true);


--
-- Name: funcionalidad_id_funcionalidad_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.funcionalidad_id_funcionalidad_seq', 96, true);


--
-- Name: gestion_academica_id_gestion_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.gestion_academica_id_gestion_seq', 2, true);


--
-- Name: grado_id_grado_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.grado_id_grado_seq', 20, true);


--
-- Name: horario_id_horario_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.horario_id_horario_seq', 27, true);


--
-- Name: inscripcion_id_inscripcion_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inscripcion_id_inscripcion_seq', 15, true);


--
-- Name: libreta_emitida_id_libreta_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.libreta_emitida_id_libreta_seq', 10, true);


--
-- Name: materia_id_materia_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.materia_id_materia_seq', 12, true);


--
-- Name: material_id_material_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.material_id_material_seq', 15, true);


--
-- Name: modulo_id_modulo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.modulo_id_modulo_seq', 45, true);


--
-- Name: movimiento_inventario_id_movimiento_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.movimiento_inventario_id_movimiento_seq', 14, true);


--
-- Name: nivel_id_nivel_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.nivel_id_nivel_seq', 8, true);


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notificacion_id_notificacion_seq', 21, true);


--
-- Name: pago_id_pago_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pago_id_pago_seq', 30, true);


--
-- Name: permiso_id_permiso_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permiso_id_permiso_seq', 70, true);


--
-- Name: profesor_id_profesor_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.profesor_id_profesor_seq', 18, true);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rol_id_rol_seq', 14, true);


--
-- Name: tutor_estudiante_id_tutor_estudiante_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tutor_estudiante_id_tutor_estudiante_seq', 21, true);


--
-- Name: tutor_id_tutor_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tutor_id_tutor_seq', 21, true);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuario_id_usuario_seq', 24, true);


--
-- Name: actividad_evaluacion actividad_evaluacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad_evaluacion
    ADD CONSTRAINT actividad_evaluacion_pkey PRIMARY KEY (id_actividad);


--
-- Name: asistencia asistencia_id_estudiante_id_curso_fecha_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_id_estudiante_id_curso_fecha_key UNIQUE (id_estudiante, id_curso, fecha);


--
-- Name: asistencia asistencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_pkey PRIMARY KEY (id_asistencia);


--
-- Name: aula aula_numero_aula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aula
    ADD CONSTRAINT aula_numero_aula_key UNIQUE (numero_aula);


--
-- Name: aula aula_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aula
    ADD CONSTRAINT aula_pkey PRIMARY KEY (id_aula);


--
-- Name: aviso aviso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso
    ADD CONSTRAINT aviso_pkey PRIMARY KEY (id_aviso);


--
-- Name: bitacora bitacora_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_pkey PRIMARY KEY (id_bitacora);


--
-- Name: calificacion calificacion_id_actividad_id_estudiante_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificacion
    ADD CONSTRAINT calificacion_id_actividad_id_estudiante_key UNIQUE (id_actividad, id_estudiante);


--
-- Name: calificacion calificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificacion
    ADD CONSTRAINT calificacion_pkey PRIMARY KEY (id_calificacion);


--
-- Name: campo_saber campo_saber_nombre_campo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campo_saber
    ADD CONSTRAINT campo_saber_nombre_campo_key UNIQUE (nombre_campo);


--
-- Name: campo_saber campo_saber_orden_visualizacion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campo_saber
    ADD CONSTRAINT campo_saber_orden_visualizacion_key UNIQUE (orden_visualizacion);


--
-- Name: campo_saber campo_saber_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campo_saber
    ADD CONSTRAINT campo_saber_pkey PRIMARY KEY (id_campo);


--
-- Name: comprobante comprobante_id_pago_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante
    ADD CONSTRAINT comprobante_id_pago_key UNIQUE (id_pago);


--
-- Name: comprobante comprobante_numero_comprobante_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante
    ADD CONSTRAINT comprobante_numero_comprobante_key UNIQUE (numero_comprobante);


--
-- Name: comprobante comprobante_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante
    ADD CONSTRAINT comprobante_pkey PRIMARY KEY (id_comprobante);


--
-- Name: concepto_pago concepto_pago_nombre_concepto_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concepto_pago
    ADD CONSTRAINT concepto_pago_nombre_concepto_key UNIQUE (nombre_concepto);


--
-- Name: concepto_pago concepto_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concepto_pago
    ADD CONSTRAINT concepto_pago_pkey PRIMARY KEY (id_concepto);


--
-- Name: curso curso_id_grado_paralelo_id_gestion_turno_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_id_grado_paralelo_id_gestion_turno_key UNIQUE (id_grado, paralelo, id_gestion, turno);


--
-- Name: curso_materia curso_materia_id_curso_id_materia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_materia
    ADD CONSTRAINT curso_materia_id_curso_id_materia_key UNIQUE (id_curso, id_materia);


--
-- Name: curso_materia curso_materia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_materia
    ADD CONSTRAINT curso_materia_pkey PRIMARY KEY (id_curso_materia);


--
-- Name: curso curso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_pkey PRIMARY KEY (id_curso);


--
-- Name: deuda deuda_estudiante_gestion_concepto_mes_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deuda
    ADD CONSTRAINT deuda_estudiante_gestion_concepto_mes_key UNIQUE (id_estudiante, id_gestion, id_concepto, mes);


--
-- Name: deuda deuda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deuda
    ADD CONSTRAINT deuda_pkey PRIMARY KEY (id_deuda);


--
-- Name: dimension_evaluacion dimension_evaluacion_nombre_dimension_id_gestion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dimension_evaluacion
    ADD CONSTRAINT dimension_evaluacion_nombre_dimension_id_gestion_key UNIQUE (nombre_dimension, id_gestion);


--
-- Name: dimension_evaluacion dimension_evaluacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dimension_evaluacion
    ADD CONSTRAINT dimension_evaluacion_pkey PRIMARY KEY (id_dimension_eval);


--
-- Name: entrega_estudiante entrega_estudiante_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrega_estudiante
    ADD CONSTRAINT entrega_estudiante_pkey PRIMARY KEY (id_entrega);


--
-- Name: estudiante estudiante_ci_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudiante
    ADD CONSTRAINT estudiante_ci_key UNIQUE (ci);


--
-- Name: estudiante estudiante_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudiante
    ADD CONSTRAINT estudiante_pkey PRIMARY KEY (id_estudiante);


--
-- Name: funcionalidad funcionalidad_metodo_id_permiso_id_modulo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionalidad
    ADD CONSTRAINT funcionalidad_metodo_id_permiso_id_modulo_key UNIQUE (metodo, id_permiso, id_modulo);


--
-- Name: funcionalidad funcionalidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionalidad
    ADD CONSTRAINT funcionalidad_pkey PRIMARY KEY (id_funcionalidad);


--
-- Name: gestion_academica gestion_academica_anio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gestion_academica
    ADD CONSTRAINT gestion_academica_anio_key UNIQUE (anio);


--
-- Name: gestion_academica gestion_academica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gestion_academica
    ADD CONSTRAINT gestion_academica_pkey PRIMARY KEY (id_gestion);


--
-- Name: grado grado_nombre_grado_id_nivel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grado
    ADD CONSTRAINT grado_nombre_grado_id_nivel_key UNIQUE (nombre_grado, id_nivel);


--
-- Name: grado grado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grado
    ADD CONSTRAINT grado_pkey PRIMARY KEY (id_grado);


--
-- Name: horario horario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario
    ADD CONSTRAINT horario_pkey PRIMARY KEY (id_horario);


--
-- Name: inscripcion inscripcion_id_estudiante_id_curso_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT inscripcion_id_estudiante_id_curso_key UNIQUE (id_estudiante, id_curso);


--
-- Name: inscripcion inscripcion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT inscripcion_pkey PRIMARY KEY (id_inscripcion);


--
-- Name: libreta_emitida libreta_emitida_estudiante_curso_gestion_trimestre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_estudiante_curso_gestion_trimestre_key UNIQUE (id_estudiante, id_curso, id_gestion, trimestre);


--
-- Name: libreta_emitida libreta_emitida_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_pkey PRIMARY KEY (id_libreta);


--
-- Name: materia materia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materia
    ADD CONSTRAINT materia_pkey PRIMARY KEY (id_materia);


--
-- Name: material material_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material
    ADD CONSTRAINT material_pkey PRIMARY KEY (id_material);


--
-- Name: modulo modulo_nombre_modulo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo
    ADD CONSTRAINT modulo_nombre_modulo_key UNIQUE (nombre_modulo);


--
-- Name: modulo modulo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo
    ADD CONSTRAINT modulo_pkey PRIMARY KEY (id_modulo);


--
-- Name: movimiento_inventario movimiento_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_inventario
    ADD CONSTRAINT movimiento_inventario_pkey PRIMARY KEY (id_movimiento);


--
-- Name: nivel nivel_nombre_nivel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nivel
    ADD CONSTRAINT nivel_nombre_nivel_key UNIQUE (nombre_nivel);


--
-- Name: nivel nivel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nivel
    ADD CONSTRAINT nivel_pkey PRIMARY KEY (id_nivel);


--
-- Name: notificacion notificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_pkey PRIMARY KEY (id_notificacion);


--
-- Name: pago pago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_pkey PRIMARY KEY (id_pago);


--
-- Name: permiso permiso_nombre_permiso_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permiso
    ADD CONSTRAINT permiso_nombre_permiso_key UNIQUE (nombre_permiso);


--
-- Name: permiso permiso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permiso
    ADD CONSTRAINT permiso_pkey PRIMARY KEY (id_permiso);


--
-- Name: profesor profesor_ci_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profesor
    ADD CONSTRAINT profesor_ci_key UNIQUE (ci);


--
-- Name: profesor profesor_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profesor
    ADD CONSTRAINT profesor_id_usuario_key UNIQUE (id_usuario);


--
-- Name: profesor profesor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profesor
    ADD CONSTRAINT profesor_pkey PRIMARY KEY (id_profesor);


--
-- Name: rol_funcionalidad rol_funcionalidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_funcionalidad
    ADD CONSTRAINT rol_funcionalidad_pkey PRIMARY KEY (id_rol, id_funcionalidad);


--
-- Name: rol rol_nombre_rol_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_nombre_rol_key UNIQUE (nombre_rol);


--
-- Name: rol_permiso rol_permiso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_pkey PRIMARY KEY (id_rol, id_permiso);


--
-- Name: rol rol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);


--
-- Name: tutor tutor_ci_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor
    ADD CONSTRAINT tutor_ci_key UNIQUE (ci);


--
-- Name: tutor_estudiante tutor_estudiante_id_tutor_id_estudiante_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_estudiante
    ADD CONSTRAINT tutor_estudiante_id_tutor_id_estudiante_key UNIQUE (id_tutor, id_estudiante);


--
-- Name: tutor_estudiante tutor_estudiante_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_estudiante
    ADD CONSTRAINT tutor_estudiante_pkey PRIMARY KEY (id_tutor_estudiante);


--
-- Name: tutor tutor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor
    ADD CONSTRAINT tutor_pkey PRIMARY KEY (id_tutor);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: usuario usuario_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_username_key UNIQUE (username);


--
-- Name: idx_asistencia_estudiante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asistencia_estudiante ON public.asistencia USING btree (id_estudiante);


--
-- Name: idx_asistencia_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asistencia_fecha ON public.asistencia USING btree (fecha);


--
-- Name: idx_bitacora_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bitacora_fecha ON public.bitacora USING btree (fecha_hora);


--
-- Name: idx_bitacora_tabla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bitacora_tabla ON public.bitacora USING btree (tabla_afectada);


--
-- Name: idx_bitacora_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bitacora_usuario ON public.bitacora USING btree (id_usuario);


--
-- Name: idx_calificacion_actividad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calificacion_actividad ON public.calificacion USING btree (id_actividad);


--
-- Name: idx_calificacion_estudiante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calificacion_estudiante ON public.calificacion USING btree (id_estudiante);


--
-- Name: idx_curso_gestion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_curso_gestion ON public.curso USING btree (id_gestion);


--
-- Name: idx_curso_grado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_curso_grado ON public.curso USING btree (id_grado);


--
-- Name: idx_deuda_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deuda_estado ON public.deuda USING btree (estado);


--
-- Name: idx_deuda_estudiante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deuda_estudiante ON public.deuda USING btree (id_estudiante);


--
-- Name: idx_funcionalidad_modulo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funcionalidad_modulo ON public.funcionalidad USING btree (id_modulo);


--
-- Name: idx_funcionalidad_permiso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funcionalidad_permiso ON public.funcionalidad USING btree (id_permiso);


--
-- Name: idx_inscripcion_curso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inscripcion_curso ON public.inscripcion USING btree (id_curso);


--
-- Name: idx_inscripcion_estudiante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inscripcion_estudiante ON public.inscripcion USING btree (id_estudiante);


--
-- Name: idx_materia_campo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materia_campo ON public.materia USING btree (id_campo);


--
-- Name: idx_pago_deuda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pago_deuda ON public.pago USING btree (id_deuda);


--
-- Name: idx_pago_estudiante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pago_estudiante ON public.pago USING btree (id_estudiante);


--
-- Name: idx_usuario_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_usuario_email_unique ON public.usuario USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: idx_usuario_rol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_rol ON public.usuario USING btree (id_rol);


--
-- Name: pago trg_actualizar_deuda_al_pagar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_actualizar_deuda_al_pagar AFTER INSERT OR UPDATE ON public.pago FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_deuda_al_pagar();


--
-- Name: movimiento_inventario trg_actualizar_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_actualizar_stock AFTER INSERT ON public.movimiento_inventario FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_stock();


--
-- Name: asistencia trg_bitacora_asistencia; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bitacora_asistencia AFTER INSERT OR UPDATE ON public.asistencia FOR EACH ROW EXECUTE FUNCTION public.fn_bitacora_asistencia();


--
-- Name: entrega_estudiante trg_bitacora_entrega; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bitacora_entrega AFTER INSERT ON public.entrega_estudiante FOR EACH ROW EXECUTE FUNCTION public.fn_bitacora_entrega();


--
-- Name: pago trg_bitacora_pago; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bitacora_pago AFTER INSERT OR UPDATE ON public.pago FOR EACH ROW EXECUTE FUNCTION public.fn_bitacora_pago();


--
-- Name: estudiante trg_calcular_edad; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_calcular_edad BEFORE INSERT OR UPDATE OF fecha_nacimiento ON public.estudiante FOR EACH ROW EXECUTE FUNCTION public.fn_calcular_edad();


--
-- Name: entrega_estudiante trg_validar_entrega_autorizada; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_entrega_autorizada BEFORE INSERT ON public.entrega_estudiante FOR EACH ROW EXECUTE FUNCTION public.fn_validar_entrega_autorizada();


--
-- Name: inscripcion trg_validar_inscripcion_unica; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_inscripcion_unica BEFORE INSERT OR UPDATE ON public.inscripcion FOR EACH ROW EXECUTE FUNCTION public.fn_validar_inscripcion_unica();


--
-- Name: calificacion trg_validar_nota_maxima; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_nota_maxima BEFORE INSERT OR UPDATE ON public.calificacion FOR EACH ROW EXECUTE FUNCTION public.fn_validar_nota_maxima();


--
-- Name: deuda trg_verificar_mora_al_generar_deuda; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_verificar_mora_al_generar_deuda AFTER INSERT ON public.deuda FOR EACH ROW EXECUTE FUNCTION public.fn_marcar_deudas_en_mora();


--
-- Name: actividad_evaluacion actividad_evaluacion_id_curso_materia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad_evaluacion
    ADD CONSTRAINT actividad_evaluacion_id_curso_materia_fkey FOREIGN KEY (id_curso_materia) REFERENCES public.curso_materia(id_curso_materia);


--
-- Name: actividad_evaluacion actividad_evaluacion_id_dimension_eval_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad_evaluacion
    ADD CONSTRAINT actividad_evaluacion_id_dimension_eval_fkey FOREIGN KEY (id_dimension_eval) REFERENCES public.dimension_evaluacion(id_dimension_eval);


--
-- Name: asistencia asistencia_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso);


--
-- Name: asistencia asistencia_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: asistencia asistencia_id_usuario_registro_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_id_usuario_registro_fkey FOREIGN KEY (id_usuario_registro) REFERENCES public.usuario(id_usuario);


--
-- Name: aviso aviso_id_curso_destino_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso
    ADD CONSTRAINT aviso_id_curso_destino_fkey FOREIGN KEY (id_curso_destino) REFERENCES public.curso(id_curso);


--
-- Name: aviso aviso_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso
    ADD CONSTRAINT aviso_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: bitacora bitacora_id_funcionalidad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_id_funcionalidad_fkey FOREIGN KEY (id_funcionalidad) REFERENCES public.funcionalidad(id_funcionalidad);


--
-- Name: bitacora bitacora_id_modulo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_id_modulo_fkey FOREIGN KEY (id_modulo) REFERENCES public.modulo(id_modulo);


--
-- Name: bitacora bitacora_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: calificacion calificacion_id_actividad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificacion
    ADD CONSTRAINT calificacion_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES public.actividad_evaluacion(id_actividad);


--
-- Name: calificacion calificacion_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificacion
    ADD CONSTRAINT calificacion_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: comprobante comprobante_id_pago_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante
    ADD CONSTRAINT comprobante_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES public.pago(id_pago);


--
-- Name: curso curso_id_aula_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_id_aula_fkey FOREIGN KEY (id_aula) REFERENCES public.aula(id_aula);


--
-- Name: curso curso_id_gestion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_id_gestion_fkey FOREIGN KEY (id_gestion) REFERENCES public.gestion_academica(id_gestion);


--
-- Name: curso curso_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grado(id_grado);


--
-- Name: curso curso_id_profesor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso
    ADD CONSTRAINT curso_id_profesor_fkey FOREIGN KEY (id_profesor) REFERENCES public.profesor(id_profesor);


--
-- Name: curso_materia curso_materia_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_materia
    ADD CONSTRAINT curso_materia_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso);


--
-- Name: curso_materia curso_materia_id_materia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_materia
    ADD CONSTRAINT curso_materia_id_materia_fkey FOREIGN KEY (id_materia) REFERENCES public.materia(id_materia);


--
-- Name: curso_materia curso_materia_id_profesor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_materia
    ADD CONSTRAINT curso_materia_id_profesor_fkey FOREIGN KEY (id_profesor) REFERENCES public.profesor(id_profesor);


--
-- Name: deuda deuda_id_concepto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deuda
    ADD CONSTRAINT deuda_id_concepto_fkey FOREIGN KEY (id_concepto) REFERENCES public.concepto_pago(id_concepto);


--
-- Name: deuda deuda_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deuda
    ADD CONSTRAINT deuda_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: deuda deuda_id_gestion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deuda
    ADD CONSTRAINT deuda_id_gestion_fkey FOREIGN KEY (id_gestion) REFERENCES public.gestion_academica(id_gestion);


--
-- Name: dimension_evaluacion dimension_evaluacion_id_gestion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dimension_evaluacion
    ADD CONSTRAINT dimension_evaluacion_id_gestion_fkey FOREIGN KEY (id_gestion) REFERENCES public.gestion_academica(id_gestion);


--
-- Name: entrega_estudiante entrega_estudiante_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrega_estudiante
    ADD CONSTRAINT entrega_estudiante_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: entrega_estudiante entrega_estudiante_id_tutor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrega_estudiante
    ADD CONSTRAINT entrega_estudiante_id_tutor_fkey FOREIGN KEY (id_tutor) REFERENCES public.tutor(id_tutor);


--
-- Name: entrega_estudiante entrega_estudiante_id_usuario_supervisor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrega_estudiante
    ADD CONSTRAINT entrega_estudiante_id_usuario_supervisor_fkey FOREIGN KEY (id_usuario_supervisor) REFERENCES public.usuario(id_usuario);


--
-- Name: funcionalidad funcionalidad_id_modulo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionalidad
    ADD CONSTRAINT funcionalidad_id_modulo_fkey FOREIGN KEY (id_modulo) REFERENCES public.modulo(id_modulo) ON DELETE CASCADE;


--
-- Name: funcionalidad funcionalidad_id_permiso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionalidad
    ADD CONSTRAINT funcionalidad_id_permiso_fkey FOREIGN KEY (id_permiso) REFERENCES public.permiso(id_permiso) ON DELETE CASCADE;


--
-- Name: grado grado_id_nivel_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grado
    ADD CONSTRAINT grado_id_nivel_fkey FOREIGN KEY (id_nivel) REFERENCES public.nivel(id_nivel);


--
-- Name: horario horario_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario
    ADD CONSTRAINT horario_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso);


--
-- Name: horario horario_id_materia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario
    ADD CONSTRAINT horario_id_materia_fkey FOREIGN KEY (id_materia) REFERENCES public.materia(id_materia);


--
-- Name: inscripcion inscripcion_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT inscripcion_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso);


--
-- Name: inscripcion inscripcion_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT inscripcion_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: libreta_emitida libreta_emitida_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso);


--
-- Name: libreta_emitida libreta_emitida_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: libreta_emitida libreta_emitida_id_gestion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_id_gestion_fkey FOREIGN KEY (id_gestion) REFERENCES public.gestion_academica(id_gestion);


--
-- Name: libreta_emitida libreta_emitida_id_usuario_aprobador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libreta_emitida
    ADD CONSTRAINT libreta_emitida_id_usuario_aprobador_fkey FOREIGN KEY (id_usuario_aprobador) REFERENCES public.usuario(id_usuario);


--
-- Name: materia materia_id_campo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materia
    ADD CONSTRAINT materia_id_campo_fkey FOREIGN KEY (id_campo) REFERENCES public.campo_saber(id_campo);


--
-- Name: movimiento_inventario movimiento_inventario_id_material_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_inventario
    ADD CONSTRAINT movimiento_inventario_id_material_fkey FOREIGN KEY (id_material) REFERENCES public.material(id_material);


--
-- Name: movimiento_inventario movimiento_inventario_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_inventario
    ADD CONSTRAINT movimiento_inventario_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: notificacion notificacion_id_aviso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_id_aviso_fkey FOREIGN KEY (id_aviso) REFERENCES public.aviso(id_aviso);


--
-- Name: notificacion notificacion_id_tutor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_id_tutor_fkey FOREIGN KEY (id_tutor) REFERENCES public.tutor(id_tutor);


--
-- Name: pago pago_id_deuda_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_id_deuda_fkey FOREIGN KEY (id_deuda) REFERENCES public.deuda(id_deuda);


--
-- Name: pago pago_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: pago pago_id_usuario_registro_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_id_usuario_registro_fkey FOREIGN KEY (id_usuario_registro) REFERENCES public.usuario(id_usuario);


--
-- Name: profesor profesor_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profesor
    ADD CONSTRAINT profesor_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: rol_funcionalidad rol_funcionalidad_id_funcionalidad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_funcionalidad
    ADD CONSTRAINT rol_funcionalidad_id_funcionalidad_fkey FOREIGN KEY (id_funcionalidad) REFERENCES public.funcionalidad(id_funcionalidad) ON DELETE CASCADE;


--
-- Name: rol_funcionalidad rol_funcionalidad_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_funcionalidad
    ADD CONSTRAINT rol_funcionalidad_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol) ON DELETE CASCADE;


--
-- Name: rol_permiso rol_permiso_id_permiso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_id_permiso_fkey FOREIGN KEY (id_permiso) REFERENCES public.permiso(id_permiso) ON DELETE CASCADE;


--
-- Name: rol_permiso rol_permiso_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol) ON DELETE CASCADE;


--
-- Name: tutor_estudiante tutor_estudiante_id_estudiante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_estudiante
    ADD CONSTRAINT tutor_estudiante_id_estudiante_fkey FOREIGN KEY (id_estudiante) REFERENCES public.estudiante(id_estudiante);


--
-- Name: tutor_estudiante tutor_estudiante_id_tutor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_estudiante
    ADD CONSTRAINT tutor_estudiante_id_tutor_fkey FOREIGN KEY (id_tutor) REFERENCES public.tutor(id_tutor);


--
-- Name: usuario usuario_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol);


--
-- PostgreSQL database dump complete
--

\unrestrict d5za3Ym3xUPfARZRXSnZgpoT19caZLQ6Orx3WJvx5hjqqtb5m7jd8OYkeZel0cC


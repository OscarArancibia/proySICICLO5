// Esquema resumido de la base de datos que se entrega a Gemini como contexto
// para traducir preguntas en lenguaje natural a consultas SQL (PostgreSQL).
// Solo se describen las tablas y columnas relevantes para consultas de lectura.

const DB_SCHEMA = `
-- Base de datos PostgreSQL del Colegio FMS. Solo lectura (SELECT).

estudiante(id_estudiante PK, nombre, apellido, ci, fecha_nacimiento, edad, genero, estado['activo','inactivo','retirado','egresado'], observaciones)
nivel(id_nivel PK, nombre_nivel, monto_mensualidad)
grado(id_grado PK, nombre_grado, id_nivel FK->nivel)
gestion_academica(id_gestion PK, anio, fecha_inicio, fecha_fin, estado['planificada','activa','cerrada'])
aula(id_aula PK, numero_aula, descripcion, capacidad_estudiantes)
profesor(id_profesor PK, id_usuario FK->usuario, nombre, apellido, ci, profesion, genero, estado bool)
curso(id_curso PK, id_grado FK->grado, paralelo, id_aula FK->aula, id_gestion FK->gestion_academica, id_profesor FK->profesor (profesor titular), turno['Mañana','Tarde'], estado bool)
inscripcion(id_inscripcion PK, id_estudiante FK->estudiante, id_curso FK->curso, fecha_inscripcion, estado['inscrito','retirado','trasladado'])
materia(id_materia PK, nombre_materia, descripcion, id_campo, estado bool)
curso_materia(id_curso_materia PK, id_curso FK->curso, id_materia FK->materia, id_profesor FK->profesor)
horario(id_horario PK, id_curso FK->curso, id_materia FK->materia, dia_semana['lunes'..'viernes'], hora_inicio, hora_fin, actividad, publicado bool)
asistencia(id_asistencia PK, id_estudiante FK, id_curso FK, fecha, estado['P'presente,'A'ausente,'T'tardanza,'J'justificado,'L'licencia])
dimension_evaluacion(id_dimension_eval PK, nombre_dimension['Ser','Saber','Hacer','Autoevaluacion'], puntaje_maximo, id_gestion FK)
actividad_evaluacion(id_actividad PK, id_curso_materia FK->curso_materia, id_dimension_eval FK->dimension_evaluacion, trimestre[1-3], nombre_actividad, fecha_actividad)
calificacion(id_calificacion PK, id_actividad FK->actividad_evaluacion, id_estudiante FK->estudiante, nota numeric, fecha_evaluacion)
concepto_pago(id_concepto PK, nombre_concepto, descripcion)
deuda(id_deuda PK, id_estudiante FK, id_gestion FK, id_concepto FK->concepto_pago, monto, mes, estado['pendiente','pagado','mora'])
pago(id_pago PK, id_deuda FK->deuda, id_estudiante FK, monto_pagado, metodo_pago['efectivo','QR','transferencia'], estado['pendiente_validacion','validado','rechazado'], fecha_pago)
material(id_material PK, nombre_item, descripcion, categoria, stock_actual, stock_minimo, estado bool)
movimiento_inventario(id_movimiento PK, id_material FK->material, tipo_movimiento['entrada','salida'], cantidad, fecha_movimiento, id_usuario FK)
tutor(id_tutor PK, nombre, apellido, ci, genero, telefono, correo_electronico, direccion)
tutor_estudiante(id_tutor_estudiante PK, id_tutor FK->tutor, id_estudiante FK->estudiante, parentesco, autorizado_recoger bool, contacto_emergencia bool)
entrega_estudiante(id_entrega PK, id_estudiante FK, id_tutor FK, id_usuario_supervisor FK->usuario, fecha_hora_entrega, observaciones)
usuario(id_usuario PK, username, id_rol FK->rol, estado bool, email)
rol(id_rol PK, nombre_rol, descripcion)

-- Notas:
-- * El "curso" identifica grado + paralelo (ej. "Segundo B" = grado 'Segundo' + paralelo 'B').
-- * Para el aula de un curso: JOIN curso c -> aula a ON c.id_aula = a.id_aula.
-- * "plantel docente" = tabla profesor (estado = true).
-- * Estudiantes inscritos en un curso: inscripcion.estado = 'inscrito'.
-- * Deudas pendientes: deuda.estado IN ('pendiente','mora').
-- * Materiales con stock bajo: material.stock_actual <= material.stock_minimo.
`.trim();

function construirSystemPrompt() {
    return `Eres un asistente que traduce preguntas en lenguaje natural (español) a consultas SQL de SOLO LECTURA para una base de datos PostgreSQL de un sistema de gestión escolar.

ESQUEMA DE LA BASE DE DATOS:
${DB_SCHEMA}

REGLAS ESTRICTAS:
1. Genera EXCLUSIVAMENTE sentencias SELECT. Nunca INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE ni nada que modifique datos.
2. Usa únicamente las tablas y columnas del esquema anterior. No inventes nombres.
3. Limita siempre los resultados a un máximo de 200 filas (incluye LIMIT 200 cuando sea un listado).
4. Para nombres completos usa: nombre || ' ' || apellido.
5. Si la pregunta NO se puede responder con este esquema o está fuera del dominio escolar, marca "fuera_de_alcance": true.
6. No uses punto y coma múltiples ni varias sentencias. Una sola consulta SELECT.
7. Responde SIEMPRE en formato JSON válido, sin texto adicional ni markdown.

FORMATO DE RESPUESTA (JSON):
{
  "fuera_de_alcance": boolean,   // true si no se puede responder
  "sql": string,                 // la consulta SELECT (vacío si fuera_de_alcance)
  "titulo": string,              // título corto y descriptivo del resultado
  "respuesta_texto": string,     // frase breve en español que describa lo que devuelve la consulta
  "es_listado": boolean          // true si el resultado es una tabla/listado, false si es un dato puntual
}`;
}

module.exports = { DB_SCHEMA, construirSystemPrompt };

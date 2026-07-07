# CICLO 3

## CU15: Registrar asistencia diaria

const pool = require("../config/db");
const { registrarBitacora, getClientIp } = require("../utils/bitacora");

/\*
TEORIA xd:

- try... catch, intenta algo en el codigo (try{ codigo ... } y si no se cumple
  hacemos el catch) imaginenlo como un "IF ELSE"
- Obtiene los cursos disponibles que tiene el profesor
- req: esto obtiene todos los datos que tiene el usuario que se encuentra logeado en ese momento
- res: usamos esta instancia para devolver algo al usuario, aca se guarda la respuesta
- $1, $2... cosas como esa, es para obtener los datos aparte, ya sea Id's, codigos, etc pero los manda aparte, en otras palabras
  guardas ese campo para el id, que estes consultando o codigos
- await pool.query(), cuando ponemos esto, hacemos consultas a la base de datos y el await sirve, para decirle que espere pero que si se va a resolver (espera un mommento que esto tarda, pero si cumple)
- async (Asincrono): un metodo del tipo asincrono, permite hacer diferentes tareas a la vez, y no se queda esperando un mismo resultado, sino que toma algo y luego hace lo que tiene pendiente, no bloquea durante una espera(asi lo entendi xd)
  \*/
  const pool = require("../config/db");
  const { registrarBitacora, getClientIp } = require("../utils/bitacora");

// Mapeo de estados (texto -> código y viceversa)
const estadoMap = {
presente: "P",
ausente: "A",
tardanza: "T",
justificado: "J",
licencia: "L",
};
const estadoTexto = {
P: "presente",
A: "ausente",
T: "tardanza",
J: "justificado",
L: "licencia",
};

// Normaliza el estado (acepta "P" o "presente")
const normalizarEstado = (estado) => {
if (!estado) return null;
const value = String(estado).trim();
return estadoMap[value.toLowerCase()] || value.toUpperCase();
};

// ──────────────────────────────────────────────────────────────────────────
// [DIAGRAMA] CONTROLADOR ASISTENCIA: Corresponde a los endpoints expuestos aquí
// ──────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// 1. Obtener cursos disponibles para el profesor (y roles autorizados)
// ──────────────────────────────────────────────────────────────────────────
// [DIAGRAMA] PASO 2: La interfaz solicita cargarCursosActivos() al Controlador
const getCursosAsistencia = async (req, res) => {
try {
let professorFilter = "";
const params = [];

    // Si es Profesor (id_rol = 3) o Docente (id_rol = 12), un poco raro por que tenemos esos 2 roles, docente y profesor
    if (req.usuario.role === 3 || req.usuario.role === 12) {
      professorFilter = `AND (c.id_profesor = (SELECT id_profesor FROM profesor WHERE id_usuario = $1)
                                OR c.id_curso IN (
                                    SELECT cm.id_curso FROM curso_materia cm
                                    JOIN profesor p ON p.id_profesor = cm.id_profesor
                                    WHERE p.id_usuario = $1
                                ))`;
      params.push(req.usuario.id);//obtiene el id del usuario que intenta tomar la lista
    }

    // [DIAGRAMA] PASO 3: El controlador ejecuta obtenerCursosActivos() consultando a la entidad Curso
    // [DIAGRAMA] Restricción implícita: WHERE ga.estado = 'activa' (Valida que la gestión esté vigente)
    const result = await pool.query(
      `
      SELECT
          c.id_curso,
          g.nombre_grado,
          n.nombre_nivel,
          c.paralelo,
          c.turno,
          ga.anio,
          COUNT(i.id_estudiante)::int AS total_estudiantes
      FROM curso c
      JOIN grado g ON g.id_grado = c.id_grado
      JOIN nivel n ON n.id_nivel = g.id_nivel
      JOIN gestion_academica ga ON ga.id_gestion = c.id_gestion
      LEFT JOIN inscripcion i ON i.id_curso = c.id_curso AND i.estado = 'inscrito'
      WHERE ga.estado = 'activa' ${professorFilter} //aqui, esta la validacion
      GROUP BY c.id_curso, g.nombre_grado, n.id_nivel, n.nombre_nivel, c.paralelo, c.turno, ga.anio
      ORDER BY n.id_nivel, g.nombre_grado, c.paralelo
      `,
      params,
    );

    // [DIAGRAMA] PASO 4: La entidad Curso retorna la listaCursos al Controlador
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No hay cursos disponibles para asistencia" });
    }

    // El controlador responde exitosamente enviando los datos a la interfaz
    res.json(result.rows);

} catch (error) {
console.error("Error en getCursosAsistencia:", error);
res.status(500).json({
message: "Error al obtener cursos para asistencia",
error: error.message,
});
}
};

// ──────────────────────────────────────────────────────────────────────────
// 2. Obtener asistencia de un curso en una fecha específica
// ──────────────────────────────────────────────────────────────────────────
// [DIAGRAMA] PASO 5: El profesor ejecuta seleccionarCursoYFecha(id_curso, fecha) en la interfaz
const getAsistenciaCurso = async (req, res) => {
const { id_curso } = req.params;
const { fecha = new Date().toISOString().slice(0, 10) } = req.query;

try {
// [DIAGRAMA] PASO 7 y 8: verificarCursoActivo(id_curso) -> retorna si el curso es válido
const cursoCheck = await pool.query(
"SELECT id_curso FROM curso WHERE id_curso = $1",
[id_curso],
);
if (cursoCheck.rows.length === 0) {
return res.status(404).json({ message: "Curso no encontrado" });
}

    // [DIAGRAMA] PASO 9 y 10: El controlador invoca listarEstudiantesActivos(id_curso) a la entidad Inscripción
    // [DIAGRAMA] PASO 11 y 12: En la misma consulta (vía LEFT JOIN), se invoca obtenerAsistenciaPorFecha(id_curso, fecha) a la entidad Asistencia
    const estudiantes = await pool.query(
      `
      SELECT
          e.id_estudiante,
          e.nombre,
          e.apellido,
          e.ci,
          a.id_asistencia,
          a.estado,
          a.observaciones
      FROM inscripcion i
      JOIN estudiante e ON e.id_estudiante = i.id_estudiante
      LEFT JOIN asistencia a
        ON a.id_estudiante = e.id_estudiante
       AND a.id_curso = i.id_curso
       AND a.fecha = $2::date
      WHERE i.id_curso = $1
        AND i.estado = 'inscrito'
        AND e.estado = 'activo'
      ORDER BY e.apellido, e.nombre
      `,
      [id_curso, fecha],
    );

    // [DIAGRAMA] Alt: Curso sin estudiantes activos -> mostrarAviso() si la lista viene vacía
    if (estudiantes.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No hay estudiantes activos en este curso" });
    }

    // [DIAGRAMA] PASO 13: El controlador arma y envía mostrarListaAsistencia(lista, resumen)
    // Aquí se genera el objeto "resumen" requerido por el diagrama
    const resumen = estudiantes.rows.reduce((acc, row) => {
      const estado = row.estado || "pendiente";
      acc[estado] = (acc[estado] || 0) + 1;
      return acc;
    }, {});

    // [DIAGRAMA] PASO 13 (Continuación): Respuesta final enviada a la Interfaz de Gestión de Asistencias
    res.json({
      fecha,
      id_curso: Number(id_curso),
      resumen,
      estudiantes: estudiantes.rows.map((row) => ({
        ...row,
        estado_texto: row.estado ? estadoTexto[row.estado] : null,
      })),
    });

} catch (error) {
console.error("Error en getAsistenciaCurso:", error);
res
.status(500)
.json({ message: "Error al obtener asistencia", error: error.message });
}
};

// ──────────────────────────────────────────────────────────────────────────
// 3. Registrar (o actualizar) la asistencia de un curso en una fecha
// ──────────────────────────────────────────────────────────────────────────
// [DIAGRAMA] PASO 14 y 15: El profesor ejecuta marcarEstados() y la interfaz invoca guardarAsistencia(lista_asistencia)
const registrarAsistencia = async (req, res) => {
const { id_curso } = req.params;
const { fecha, asistencias } = req.body;

// Validaciones básicas de la petición
if (!fecha || !Array.isArray(asistencias)) {
return res
.status(400)
.json({ message: "La fecha y la lista de asistencias son obligatorias" });
}

// ── [DIAGRAMA] PASO 6 y Alt: Fecha futura ──
// El controlador ejecuta validarFecha(fecha). Si es futura, corta el flujo y ejecuta mostrarError("No se permiten fechas futuras")
const today = new Date().toISOString().slice(0, 10);
if (fecha > today) { //primer alt, sobre la fecha futura
return res.status(400).json({ message: "La fecha no puede ser futura" });
}

const client = await pool.connect();
try {
await client.query("BEGIN");

    // Verificación adicional de seguridad para el estado del curso
    const cursoExiste = await client.query(
      "SELECT id_curso, id_gestion FROM curso WHERE id_curso = $1 AND estado = true",
      [id_curso],
    );
    if (cursoExiste.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ message: "Curso no encontrado o inactivo" });
    }

    // Validación de permisos del profesor asignado
    const rol = req.usuario.role;
    if (rol === 3 || rol === 12) {
      const acceso = await client.query(
        `
        SELECT 1 FROM curso c
        WHERE c.id_curso = $1 AND (
          c.id_profesor = (SELECT id_profesor FROM profesor WHERE id_usuario = $2)
          OR EXISTS (
            SELECT 1 FROM curso_materia cm
            JOIN profesor p ON p.id_profesor = cm.id_profesor
            WHERE cm.id_curso = c.id_curso AND p.id_usuario = $2
          )
        )
        `,
        [id_curso, req.usuario.id],
      );
      if (acceso.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "No tienes permiso para registrar asistencia en este curso",
        });
      }
    }

    // Control preventivo de alumnos pertenecientes al curso actual
    const estudiantesValidos = await client.query(
      `
      SELECT e.id_estudiante
      FROM inscripcion i
      JOIN estudiante e ON e.id_estudiante = i.id_estudiante
      WHERE i.id_curso = $1
        AND i.estado = 'inscrito'
        AND e.estado = 'activo'
      `,
      [id_curso],
    );
    const idsPermitidos = new Set(
      jestudiantesValidos.rows.map((r) => r.id_estudiante),
    );

    // Validación de formato de datos antes de impactar la base de datos
    for (const item of asistencias) {
      const estado = normalizarEstado(item.estado);
      if (!item.id_estudiante || !["P", "A", "T", "J", "L"].includes(estado)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            "Cada asistencia debe incluir estudiante y estado válido (P, A, T, J, L)",
        });
      }
      if (!idsPermitidos.has(item.id_estudiante)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `El estudiante ${item.id_estudiante} no está activo o no se encuentra inscrito en este curso`,
        });
      }
    }

    // ── [DIAGRAMA] PASO 16 y 17: upsertAsistencia(lista_asistencia) ──
    // Se recorre el arreglo y se ejecuta el bloque INSERT ... ON CONFLICT DO UPDATE (Definición de UPSERT)
    // Al finalizar el bucle, la base de datos responde "asistencia guardada / actualizada"
    const resultado = [];
    for (const item of asistencias) {
      const estado = normalizarEstado(item.estado);
      const saved = await client.query(
        `
        INSERT INTO asistencia (
            id_estudiante, id_curso, fecha, estado,
            observaciones, id_usuario_registro
        )
        VALUES ($1, $2, $3::date, $4, $5, $6)
        ON CONFLICT (id_estudiante, id_curso, fecha)
        DO UPDATE SET
            estado = EXCLUDED.estado,
            observaciones = EXCLUDED.observaciones,
            id_usuario_registro = EXCLUDED.id_usuario_registro,
            fecha_registro = NOW()
        RETURNING *
        `,
        [
          item.id_estudiante,
          id_curso,
          fecha,
          estado,
          item.observaciones || null,
          req.usuario.id,
        ],
      );
      resultado.push(saved.rows[0]);
    }

    await client.query("COMMIT");

    // ── [DIAGRAMA] PASO 18 y 19: registrarEvento(datosEvento) ──
    // El controlador llama a la entidad Bitácora (Sistema) para dejar registro de la acción y recibe su confirmación
    await registrarBitacora({
      id_usuario: req.usuario.id,
      nombre_modulo: "asistencias",
      nombre_permiso: "registrar_asistencia",
      metodo: "POST /api/asistencias/curso/:id_curso",
      accion: "INSERT_OR_UPDATE",
      tabla_afectada: "asistencia",
      id_registro_afectado: Number(id_curso),
      descripcion: `Registro de asistencia del curso ${id_curso} para la fecha ${fecha}`,
      ip_origen: getClientIp(req),
    });

    // ── [DIAGRAMA] NOTA SOBRE PASOS 22 Y 23 ──
    // Aquí es donde deberían llamarse las funciones evaluarInasistenciasRepetidas()
    // y emitir el aviso opcional a la entidad Notificación (Faltante actual en este código).

    // ── [DIAGRAMA] PASO 20 y 21: confirmar("Asistencia guardada correctamente") y actualizarResumen() ──
    // El servidor responde exitosamente al frontend, permitiendo gatillar los flujos visuales de confirmación
    res.json({
      message: "Asistencia guardada correctamente",
      asistencias: resultado,
    });

} catch (error) {
await client.query("ROLLBACK");
console.error("Error en registrarAsistencia:", error);
res
.status(500)
.json({ message: "Error al guardar asistencia", error: error.message });
} finally {
client.release();
}
};

// ──────────────────────────────────────────────────────────────────────────
// [NUEVO] 4. Consultar asistencia anterior (Tercer Alt del Diagrama)
// ──────────────────────────────────────────────────────────────────────────
const consultarAsistenciaAnterior = async (req, res) => {
const { id_curso } = req.params;
const { fecha } = req.query; // Aquí la fecha es obligatoria del pasado

if (!fecha) {
return res.status(400).json({ message: "La fecha es requerida para consultar el historial" });
}

try {
// [DIAGRAMA] Ejecuta: buscarPorCursoYFecha(id_curso, fecha)
// En el historial, usamos INNER JOIN porque SOLO queremos alumnos que ya tengan asistencia guardada
const registros = await pool.query(
`       SELECT
          e.id_estudiante,
          e.nombre,
          e.apellido,
          e.ci,
          a.id_asistencia,
          a.estado,
          a.observaciones,
          a.fecha_registro
      FROM asistencia a
      JOIN estudiante e ON e.id_estudiante = a.id_estudiante
      WHERE a.id_curso = $1 AND a.fecha = $2::date
      ORDER BY e.apellido, e.nombre
      `,
[id_curso, fecha]
);

    // [DIAGRAMA] Si no hay registros guardados en esa fecha pasada
    if (registros.rows.length === 0) {
      return res.status(404).json({
        message: "No se encontraron registros de asistencia para la fecha solicitada"
      });
    }

    // Calculamos el resumen para la vista histórica
    const resumen = registros.rows.reduce((acc, row) => {
      acc[row.estado] = (acc[row.estado] || 0) + 1;
      return acc;
    }, {});

    // [DIAGRAMA] Retorna los registros guardados e indica explícitamente que es SOLO LECTURA
    res.json({
      fecha,
      id_curso: Number(id_curso),
      soloLectura: true, // <- Esta bandera le dice a la interfaz: "ejecuta mostrarConsultaSoloLectura()"
      resumen,
      estudiantes: registros.rows.map((row) => ({
        ...row,
        estado_texto: estadoTexto[row.estado],
      })),
    });

} catch (error) {
console.error("Error en consultarAsistenciaAnterior:", error);
res.status(500).json({ message: "Error al consultar asistencia histórica", error: error.message });
}
};

// ──────────────────────────────────────────────────────────────────────────
// 4. Consultar asistencia anterior (Tercer Alt del Diagrama, ns si sea correcto hacer otro meotodo, segun salia que no eran parte de los pasos y habia un ALT aparte)
// ──────────────────────────────────────────────────────────────────────────
const consultarAsistenciaAnterior = async (req, res) => {
const { id_curso } = req.params;
const { fecha } = req.query; // Aquí la fecha es obligatoria del pasado

if (!fecha) {
return res.status(400).json({ message: "La fecha es requerida para consultar el historial" });
}

try {
// [DIAGRAMA] buscarPorCursoYFecha(id_curso, fecha)
// En el historial, usamos INNER JOIN porque SOLO queremos alumnos que ya tengan asistencia guardada
const registros = await pool.query( // [DIAGRAMA] consulta las asistencias
`       SELECT
          e.id_estudiante,
          e.nombre,
          e.apellido,
          e.ci,
          a.id_asistencia,
          a.estado,
          a.observaciones,
          a.fecha_registro
      FROM asistencia a
      JOIN estudiante e ON e.id_estudiante = a.id_estudiante
      WHERE a.id_curso = $1 AND a.fecha = $2::date
      ORDER BY e.apellido, e.nombre
      `,
[id_curso, fecha]
);

    // [DIAGRAMA] Si no hay registros guardados en esa fecha pasada
    if (registros.rows.length === 0) {
      return res.status(404).json({
        message: "No se encontraron registros de asistencia para la fecha solicitada"
      });
    }

    // Calculamos el resumen para la vista histórica
    const resumen = registros.rows.reduce((acc, row) => {
      acc[row.estado] = (acc[row.estado] || 0) + 1;
      return acc;
    }, {});

    // [DIAGRAMA] Retorna los registros guardados e indica explícitamente que es SOLO LECTURA
    res.json({
      fecha,
      id_curso: Number(id_curso),
      soloLectura: true, // aqui esta el paso de solo lectura
      resumen,
      estudiantes: registros.rows.map((row) => ({
        ...row,
        estado_texto: estadoTexto[row.estado],
      })),
    });

} catch (error) {
console.error("Error en consultarAsistenciaAnterior:", error);
res.status(500).json({ message: "Error al consultar asistencia histórica", error: error.message });
}
};

module.exports = {
getCursosAsistencia,
getAsistenciaCurso,
registrarAsistencia,
consultarAsistenciaAnterior,
};

## CU16 Justificar inasistencia

const pool = require('../config/db');
const { registrarBitacora, getClientIp } = require('../utils/bitacora');

// ──────────────────────────────────────────────────────────────────────────
// FLUJO PRINCIPAL: Registro de Justificación
// ──────────────────────────────────────────────────────────────────────────

// [DIAGRAMA] PASO 1 y 2: El profesor accede al módulo y selecciona un estudiante y fecha.
// [DIAGRAMA] PASO 3: La interfaz envía "Solicita verificar inasistencia" al Controlador.
const buscarInasistencia = async (req, res) => {
const { id_estudiante, fecha } = req.query;

    if (!id_estudiante || !fecha) {
        return res.status(400).json({ message: 'El estudiante y la fecha son obligatorios' });
    }

    try {
        // [DIAGRAMA] PASO 4 y 5: El controlador hace "Consulta registro de ausencia" a la entidad Asistencia.
        // Evalúa que exista un registro con estado 'A' (Ausente).
        const result = await pool.query(`
            SELECT a.id_asistencia, a.id_estudiante, a.id_curso, a.fecha,
                   a.estado, a.observaciones,
                   e.nombre || ' ' || e.apellido AS estudiante,
                   c.paralelo, g.nombre_grado, n.nombre_nivel
            FROM asistencia a
            JOIN estudiante e ON e.id_estudiante = a.id_estudiante
            JOIN curso c ON c.id_curso = a.id_curso
            JOIN grado g ON g.id_grado = c.id_grado
            JOIN nivel n ON n.id_nivel = g.id_nivel
            WHERE a.id_estudiante = $1
              AND a.fecha = $2::date
              AND a.estado = 'A'
        `, [id_estudiante, fecha]);

        // [DIAGRAMA] Alt: EX-01 No existe inasistencia.
        // Si la base de datos no devuelve filas, no hay inasistencias
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No se encontro inasistencia registrada para esa fecha' });
        }

        // [DIAGRAMA] PASO 6: El controlador "Retorna datos de la ausencia" a la interfaz.
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error al buscar inasistencia', error: error.message });
    }

};

// [DIAGRAMA] PASO 7: El usuario registra la justificación con motivo, respaldo y observaciones en la interfaz.
// [DIAGRAMA] PASO 8: La interfaz ejecuta "Valida motivo y registro".
// [DIAGRAMA] PASO 9: La interfaz invoca "Guardar justificación (estado: pendiente)" en el Controlador.
const registrarJustificacion = async (req, res) => {
const { id_asistencia, id_estudiante, id_curso, fecha, motivo, documento_referencia, observaciones } = req.body;

    if (!id_asistencia || !motivo) {
        return res.status(400).json({ message: 'La asistencia y el motivo son obligatorios' });
    }

    const client = await pool.connect();

    try {
        // Control previo del estado de la asistencia
        const check = await client.query(
            'SELECT estado FROM asistencia WHERE id_asistencia = $1',
            [id_asistencia]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ message: 'Registro de asistencia no encontrado' });
        }

        // [DIAGRAMA] Alt: EX-02 Registro ya justificado o aprobado.
        // Tu código expande esto validando si ya está en 'J' o si no es una falta ('A').
        if (check.rows[0].estado === 'J') {
            return res.status(409).json({ message: 'Esta inasistencia ya fue justificada' });
        }

        if (check.rows[0].estado !== 'A') {
            return res.status(400).json({ message: 'Solo se pueden justificar registros con estado Ausente (A)' });
        }

        //termina el ALT: EX-02

        // Validación extra de tu lógica para evitar duplicados en la tabla justificaciones
        const justificacionExistente = await client.query(
            'SELECT id_justificacion, estado FROM justificacion WHERE id_asistencia = $1',
            [id_asistencia]
        );

        if (justificacionExistente.rows.length > 0) {
            return res.status(409).json({
                message: `Ya existe una justificacion para esta asistencia en estado: ${justificacionExistente.rows[0].estado}`
            });
        }

        await client.query('BEGIN');

        // [DIAGRAMA] PASO 10 y 11: El controlador ejecuta "Crear Justificación" con estado="pendiente"
        // en la entidad Justificación y recibe la confirmación.
        const saved = await client.query(`
            INSERT INTO justificacion (
                id_asistencia, id_estudiante, id_curso, fecha, motivo,
                documento_referencia, observaciones, estado, id_usuario_solicitante
            )
            VALUES ($1, $2, $3, $4::date, $5, $6, $7, 'pendiente', $8)
            RETURNING *
        `, [
            id_asistencia,
            id_estudiante || null,
            id_curso || null,
            fecha || null,
            motivo,
            documento_referencia || null,
            observaciones || null,
            req.usuario.id
        ]);

        await client.query('COMMIT');

        // [DIAGRAMA] PASO 12 y 13: El controlador envía "Registrar evento: JUSTIFICACIÓN_REGISTRADA"
        // a la Bitácora del Sistema y recibe la confirmación.
        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'justificaciones',
            nombre_permiso: 'gestionar_justificaciones',
            metodo: 'POST /api/justificaciones',
            accion: 'REGISTRAR_JUSTIFICACION',
            tabla_afectada: 'justificacion',
            id_registro_afectado: saved.rows[0].id_justificacion,
            descripcion: `Justificación registrada para asistencia ${id_asistencia}: ${motivo}`,
            ip_origen: getClientIp(req)
        });

        // [DIAGRAMA] PASO 13 (Continuación): El controlador envía la confirmación de guardado a la interfaz.
        res.status(201).json({
            message: 'Justificacion registrada correctamente',
            justificacion: saved.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error al registrar justificacion', error: error.message });
    } finally {
        client.release();
    }

};

// ──────────────────────────────────────────────────────────────────────────
// SUBFLUJO: Aprobación / Rechazo (Director / Secretaria)
// ──────────────────────────────────────────────────────────────────────────

// [DIAGRAMA] PASO 14 y 15: El Director consulta las justificaciones pendientes. La interfaz "Solicita listar pendientes".
const listarPendientes = async (\_req, res) => {
try {
// [DIAGRAMA] PASO 16 y 17: El controlador ejecuta "Obtener justificaciones pendientes"
// consultando a la entidad Justificación y retorna la lista a la interfaz (PASO 18).
const result = await pool.query(`             SELECT j.id_justificacion, j.id_asistencia, j.fecha, j.motivo,
                   j.documento_referencia, j.observaciones, j.fecha_solicitud,
                   e.id_estudiante, e.nombre || ' ' || e.apellido AS estudiante,
                   e.ci AS estudiante_ci,
                   c.id_curso, c.paralelo, g.nombre_grado, n.nombre_nivel,
                   u.username AS solicitante
            FROM justificacion j
            JOIN estudiante e ON e.id_estudiante = j.id_estudiante
            JOIN curso c ON c.id_curso = j.id_curso
            JOIN grado g ON g.id_grado = c.id_grado
            JOIN nivel n ON n.id_nivel = g.id_nivel
            JOIN usuario u ON u.id_usuario = j.id_usuario_solicitante
            WHERE j.estado = 'pendiente'
            ORDER BY j.fecha_solicitud DESC
        `);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al listar justificaciones pendientes', error: error.message });
    }

};

// [DIAGRAMA] PASO 19, 20, 21, 22 y 23: El Director selecciona una justificación,
// la interfaz "Solicita ver detalle", el controlador va a la base de datos y la interfaz "Muestra detalle".
// [DIAGRAMA] PASO 24 y 25: El Director resuelve (aprueba/rechaza) y la interfaz envía "Solicita actualizar estado".
const resolverJustificacion = async (req, res) => {
const { id } = req.params;
const { estado, observaciones } = req.body;

    // 1. Validaciones iniciales del formato de la petición
    if (!estado || !['aprobada', 'rechazada'].includes(estado)) {
        return res.status(400).json({ message: 'El estado debe ser aprobada o rechazada' });
    }

    const client = await pool.connect();

    try {
        // [DIAGRAMA PREVIO] Traemos la información clave de la justificación antes de modificarla
        const check = await client.query(
            'SELECT id_justificacion, id_estudiante, id_asistencia, estado FROM justificacion WHERE id_justificacion = $1',
            [id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ message: 'Justificacion no encontrada' });
        }

        const justificacionActual = check.rows[0];

        // Regla de negocio: No se puede volver a resolver algo ya procesado
        if (justificacionActual.estado !== 'pendiente') {
            return res.status(400).json({
                message: `La justificacion ya fue ${justificacionActual.estado}. Solo se pueden resolver justificaciones pendientes.`
            });
        }

        // 2. INICIAMOS LA TRANSACCIÓN
        await client.query('BEGIN');

        // [DIAGRAMA] PASO 26 y 27: Cambiar estado a 'aprobada' o 'rechazada' en la tabla 'justificacion'
        const result = await client.query(`
            UPDATE justificacion
            SET estado = $1,
                id_usuario_revisor = $2,
                fecha_resolucion = NOW(),
                observaciones = CASE
                    WHEN $3::text IS NOT NULL THEN
                        COALESCE(observaciones, '') ||
                        CASE WHEN observaciones IS NOT NULL AND observaciones != '' THEN ' | ' ELSE '' END ||
                        $3
                    ELSE observaciones
                END
            WHERE id_justificacion = $4
            RETURNING *
        `, [estado, req.usuario.id, observaciones || null, id]);


        // ALT-EX03: bloque condicional
        // si el director rechaza la justificacion de la inasistencia, no se hace lo siguiente, pero si es asi
        // actualizamos la asistencia y los indicadores del expediente
        if (estado === 'aprobada') {

            // [DIAGRAMA] PASO 28: Actualizar estado asistencia de Ausente (A) -> Justificado (J)
            await client.query(`
                UPDATE asistencia
                SET estado = 'J',
                    observaciones = COALESCE(observaciones, '') || ' [Justificado por Dirección - Solicitud #' || $1 || ']'
                WHERE id_asistencia = $2
            `, [id, justificacionActual.id_asistencia]);


            // [DIAGRAMA] PASO 29 y 30: Recalcular indicadores cuantitativos en el Expediente del alumno
            // Restamos 1 a las injustificadas (usando GREATEST para que nunca baje de 0) y sumamos 1 a las justificadas
            await client.query(`
                UPDATE expediente
                SET faltas_injustificadas = GREATEST(0, faltas_injustificadas - 1),
                    faltas_justificadas = faltas_justificadas + 1,
                    ultima_actualizacion = NOW()
                WHERE id_estudiante = $1
            `, [justificacionActual.id_estudiante]);
        }

        // 3. CONSOLIDAMOS LOS CAMBIOS EN LA BASE DE DATOS
        await client.query('COMMIT');


        // [DIAGRAMA] PASO 31 y 32: Registrar evento en la Bitácora del Sistema
        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'justificaciones',
            nombre_permiso: 'gestionar_justificaciones',
            metodo: 'PUT /api/justificaciones/:id/resolver',
            accion: 'EVALUAR_JUSTIFICACION',
            tabla_afectada: 'justificacion',
            id_registro_afectado: Number(id),
            descripcion: `Justificación #${id} resuelta como: ${estado.toUpperCase()}`,
            ip_origen: getClientIp(req)
        });


        // [DIAGRAMA] PASO 33 y 34: notificarResultado() -> Aviso opcional
        // (Espacio reservado si a futuro integras un servicio de envío de correos/NodeMailer o SMS)


        // Definición de mensajes dinámicos para la respuesta
        const mensajeExito = estado === 'aprobada'
            ? 'Justificacion aprobada correctamente. La asistencia se ha actualizado a Justificado (J) y se actualizaron los indicadores del expediente.'
            : 'Justificacion rechazada de forma exitosa. La asistencia mantiene su estado original de Ausencia (A).';

        // [DIAGRAMA] PASO 35: Mostrar confirmación ("Justificación actualizada correctamente")
        res.json({
            message: mensajeExito,
            justificacion: result.rows[0]
        });

    } catch (error) {
        // Si cualquiera de los pasos falla, cancelamos todo el bloque para no dejar datos a medias
        await client.query('ROLLBACK');
        console.error("Error crítico en resolverJustificacion:", error);
        res.status(500).json({ message: 'Error al resolver justificacion', error: error.message });
    } finally {
        // Liberamos el cliente del pool de conexiones
        client.release();
    }

};

// Función extra de tu controlador para reportería y filtros históricos
const listarJustificaciones = async (req, res) => {
const { id_estudiante, estado, fecha_desde, fecha_hasta } = req.query;

    try {
        const conditions = ['1=1'];
        const params = [];
        let idx = 1;

        if (id_estudiante) {
            conditions.push(`j.id_estudiante = $${idx++}`);
            params.push(id_estudiante);
        }
        if (estado) {
            conditions.push(`j.estado = $${idx++}`);
            params.push(estado);
        }
        if (fecha_desde) {
            conditions.push(`j.fecha >= $${idx++}::date`);
            params.push(fecha_desde);
        }
        if (fecha_hasta) {
            conditions.push(`j.fecha <= $${idx++}::date`);
            params.push(fecha_hasta);
        }

        const result = await pool.query(`
            SELECT j.*,
                   e.nombre || ' ' || e.apellido AS estudiante,
                   e.ci AS estudiante_ci,
                   c.paralelo, g.nombre_grado, n.nombre_nivel,
                   u_sol.username AS solicitante,
                   u_rev.username AS revisor
            FROM justificacion j
            JOIN estudiante e ON e.id_estudiante = j.id_estudiante
            JOIN curso c ON c.id_curso = j.id_curso
            JOIN grado g ON g.id_grado = c.id_grado
            JOIN nivel n ON n.id_nivel = g.id_nivel
            JOIN usuario u_sol ON u_sol.id_usuario = j.id_usuario_solicitante
            LEFT JOIN usuario u_rev ON u_rev.id_usuario = j.id_usuario_revisor
            WHERE ${conditions.join(' AND ')}
            ORDER BY j.fecha_solicitud DESC
        `, params);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al listar justificaciones', error: error.message });
    }

};

module.exports = { buscarInasistencia, registrarJustificacion, listarPendientes, resolverJustificacion, listarJustificaciones };

## CU17: Configurar Dimensiones de Evaluación

const pool = require('../config/db');
const { registrarBitacora, getClientIp } = require('../utils/bitacora');

// ──────────────────────────────────────────────────────────────────────────
// [DIAGRAMA] ALT: Consultar estructura
// ──────────────────────────────────────────────────────────────────────────
const obtenerDimensiones = async (\_req, res) => {
try {
// [DIAGRAMA] PASO 3 y 4: verificarGestionActiva(id_gestion) -> Retorna activa/inactiva
const gestion = await pool.query(
"SELECT id_gestion, anio FROM gestion_academica WHERE estado = 'activa' LIMIT 1"
);

        // [DIAGRAMA] Alt: EX-03 No existe gestión activa
        if (gestion.rows.length === 0) {
            return res.status(404).json({ message: 'No hay gestion academica activa' });
        }

        // [DIAGRAMA] PASO 5 y 6: cargarEstructuraBase() -> Trae dimensiones fijas (Ser 10%, Saber 45%...)
        // NOTA: Tu código las busca dinámicamente en la tabla, el diagrama dice que ya son fijas por normativa.
        const result = await pool.query(`
            SELECT id_dimension_eval, nombre_dimension, puntaje_maximo, id_gestion
            FROM dimension_evaluacion
            WHERE id_gestion = $1
            ORDER BY
                CASE nombre_dimension
                    WHEN 'Ser' THEN 1
                    WHEN 'Saber' THEN 2
                    WHEN 'Hacer' THEN 3
                    WHEN 'Autoevaluacion' THEN 4
                    ELSE 5
                END
        `, [gestion.rows[0].id_gestion]);

        // [DIAGRAMA] PASO 7: mostrarEstructuraBloqueada() o retornar datos para lectura
        res.json({
            gestion: gestion.rows[0],
            dimensiones: result.rows
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener dimensiones', error: error.message });
    }

};

// ──────────────────────────────────────────────────────────────────────────
// [DIAGRAMA] FLUJO PRINCIPAL: Guardar Estructura (Sub-puntos)
// ──────────────────────────────────────────────────────────────────────────
const guardarDimensiones = async (req, res) => {
const { dimensiones } = req.body; // ⚠️ BRECHA: Falta id_curso, id_materia, trimestre

    // [DIAGRAMA] PASO 10: validarDatosSubPunto() ⚠️
    if (!Array.isArray(dimensiones) || dimensiones.length === 0) {
        return res.status(400).json({ message: 'Debe enviar al menos una dimension' });
    }

    const nombresValidos = ['Ser', 'Saber', 'Hacer', 'Autoevaluacion'];
    for (const d of dimensiones) {
        if (!nombresValidos.includes(d.nombre_dimension)) {
            return res.status(400).json({
                message: `Dimension invalida: "${d.nombre_dimension}". Debe ser: Ser, Saber, Hacer o Autoevaluacion`
            });
        }
        if (d.puntaje_maximo === undefined || d.puntaje_maximo === null || Number(d.puntaje_maximo) <= 0) {
            return res.status(400).json({
                message: `El puntaje maximo de "${d.nombre_dimension}" debe ser un valor positivo`
            });
        }
    }

    // [DIAGRAMA] Alt: EX-01 Intentar modificar porcentajes fijos normativos
    const sumaTotal = dimensiones.reduce((sum, d) => sum + Number(d.puntaje_maximo), 0);
    if (sumaTotal !== 100) {
        return res.status(400).json({
            message: `La suma de las dimensiones debe ser exactamente 100. Suma actual: ${sumaTotal}`
        });
    }

    const client = await pool.connect();

    try {
        const gestion = await client.query(
            "SELECT id_gestion FROM gestion_academica WHERE estado = 'activa' LIMIT 1"
        );

        if (gestion.rows.length === 0) {
            return res.status(404).json({ message: 'No hay gestion academica activa' });
        }

        const id_gestion = gestion.rows[0].id_gestion;

        // [DIAGRAMA] Alt: EX-02 Edición con notas existentes (BloquearEdicionSubPuntos)
        const calificacionesCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM calificacion c
                JOIN actividad_evaluacion ae ON ae.id_actividad = c.id_actividad
                JOIN dimension_evaluacion de ON de.id_dimension_eval = ae.id_dimension_eval
                WHERE de.id_gestion = $1
                LIMIT 1
            ) AS tiene_notas
        `, [id_gestion]);

        if (calificacionesCheck.rows[0].tiene_notas) {
            return res.status(409).json({
                message: 'No se pueden modificar los puntajes maximos porque ya existen calificaciones registradas para esta gestion'
            });
        }

        const nombresEnviados = dimensiones.map(d => d.nombre_dimension);
        const nombresUnicos = new Set(nombresEnviados);
        if (nombresUnicos.size !== dimensiones.length) {
            return res.status(400).json({ message: 'No puede haber dimensiones duplicadas' });
        }

        await client.query('BEGIN');

        // DESVÍO: El diagrama pide:
        // PASO 11: configurarReglaPromedioAutomático(id_dimension)
        // PASO 12: guardarConfiguracion(estructura)
        // PASO 13: persistirDimensiones(id_gestion, contexto)
        // PASO 14: persistirSubPuntos(lista_subpuntos) -> ¡Falta la tabla Sub-puntos!
        const resultados = [];
        for (const d of dimensiones) {
            const saved = await client.query(`
                INSERT INTO dimension_evaluacion (nombre_dimension, puntaje_maximo, id_gestion)
                VALUES ($1, $2, $3)
                ON CONFLICT (nombre_dimension, id_gestion)
                DO UPDATE SET puntaje_maximo = EXCLUDED.puntaje_maximo
                RETURNING *
            `, [d.nombre_dimension, Number(d.puntaje_maximo), id_gestion]);

            resultados.push(saved.rows[0]);
        }

        await client.query('COMMIT');

        // [DIAGRAMA] PASO 16: registrarEvento(datosEvento)
        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'dimensiones',
            nombre_permiso: 'gestionar_dimensiones',
            metodo: 'POST /api/dimensiones',
            accion: 'CONFIGURAR_DIMENSIONES',
            tabla_afectada: 'dimension_evaluacion',
            id_registro_afectado: id_gestion,
            descripcion: `Dimensiones configuradas`,
            ip_origen: getClientIp(req)
        });

        // [DIAGRAMA] PASO 18: confirmar("Estructura guardada correctamente")
        res.json({ message: 'Dimensiones guardadas correctamente', dimensiones: resultados });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error al guardar dimensiones', error: error.message });
    } finally {
        client.release();
    }

};

const actualizarDimension = async (req, res) => {
const { id } = req.params;
const { puntaje_maximo } = req.body;

    if (puntaje_maximo === undefined || puntaje_maximo === null || Number(puntaje_maximo) <= 0) {
        return res.status(400).json({ message: 'El puntaje maximo debe ser un valor positivo' });
    }

    const client = await pool.connect();

    try {
        const dim = await client.query(
            'SELECT id_dimension_eval, id_gestion FROM dimension_evaluacion WHERE id_dimension_eval = $1',
            [id]
        );

        if (dim.rows.length === 0) {
            return res.status(404).json({ message: 'Dimension no encontrada' });
        }

        const calificacionesCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM calificacion c
                JOIN actividad_evaluacion ae ON ae.id_actividad = c.id_actividad
                WHERE ae.id_dimension_eval = $1
                LIMIT 1
            ) AS tiene_notas
        `, [id]);

        if (calificacionesCheck.rows[0].tiene_notas) {
            return res.status(409).json({
                message: 'No se puede modificar esta dimension porque ya existen calificaciones registradas'
            });
        }

        await client.query('BEGIN');

        const otrasSum = await client.query(`
            SELECT COALESCE(SUM(puntaje_maximo), 0) AS suma
            FROM dimension_evaluacion
            WHERE id_gestion = $1 AND id_dimension_eval != $2
        `, [dim.rows[0].id_gestion, id]);

        const nuevaSuma = Number(otrasSum.rows[0].suma) + Number(puntaje_maximo);
        if (nuevaSuma !== 100) {
            return res.status(400).json({
                message: `La suma total de las dimensiones debe ser 100. Con este cambio, la suma seria ${nuevaSuma}`
            });
        }

        const result = await client.query(`
            UPDATE dimension_evaluacion
            SET puntaje_maximo = $1
            WHERE id_dimension_eval = $2
            RETURNING *
        `, [Number(puntaje_maximo), id]);

        await client.query('COMMIT');

        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'dimensiones',
            nombre_permiso: 'gestionar_dimensiones',
            metodo: `PUT /api/dimensiones/${id}`,
            accion: 'ACTUALIZAR_DIMENSION',
            tabla_afectada: 'dimension_evaluacion',
            id_registro_afectado: Number(id),
            descripcion: `Dimensión ${result.rows[0].nombre_dimension} actualizada: puntaje_maximo = ${puntaje_maximo}`,
            ip_origen: getClientIp(req)
        });
        res.json({ message: 'Dimension actualizada correctamente', dimension: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error al actualizar dimension', error: error.message });
    } finally {
        client.release();
    }

};

module.exports = { obtenerDimensiones, guardarDimensiones, actualizarDimension };

## CU18: Registrar actividades de evaluacion

const pool = require("../config/db");
const { registrarBitacora, getClientIp } = require("../utils/bitacora");

// ──────────────────────────────────────────────────────────────────────────
// [DIAGRAMA] SUBFLUJO: Consultar actividades académicas existentes
// ──────────────────────────────────────────────────────────────────────────
const obtenerActividades = async (req, res) => {
// [DIAGRAMA] PASO 2: El profesor selecciona un curso y materia específicos en la interfaz
const { id_curso, id_materia } = req.params;

try {
// [DIAGRAMA] PASO 6: El controlador ejecuta "mostrarPanelTrimestreActual(trimestre, actividades)"
// Esta consulta recopila la estructura de evaluaciones vigentes para pintarla en el Panel de Registro Pedagógico
const result = await pool.query(
`             SELECT ae.id_actividad, ae.nombre_actividad, ae.fecha_actividad,
                   ae.trimestre, ae.id_curso_materia, ae.id_dimension_eval,
                   de.nombre_dimension, de.puntaje_maximo,
                   cm.id_curso, cm.id_materia,
                   m.nombre_materia
            FROM actividad_evaluacion ae
            JOIN curso_materia cm ON cm.id_curso_materia = ae.id_curso_materia
            JOIN dimension_evaluacion de ON de.id_dimension_eval = ae.id_dimension_eval
            JOIN materia m ON m.id_materia = cm.id_materia
            WHERE cm.id_curso = $1 AND cm.id_materia = $2
            ORDER BY ae.trimestre, ae.fecha_actividad DESC
        `,
[id_curso, id_materia],
);

    res.json(result.rows);

} catch (error) {
res
.status(500)
.json({ message: "Error al obtener actividades", error: error.message });
}
};

// ──────────────────────────────────────────────────────────────────────────
// [DIAGRAMA] FLUJO PRINCIPAL: Crear Actividad de Evaluación
// ──────────────────────────────────────────────────────────────────────────
const crearActividad = async (req, res) => {
// [DIAGRAMA] PASO 9: El profesor ingresa los datos y ejecuta "registrarActividad(datos_actividad)"
const {
id_curso_materia,
id_dimension_eval,
trimestre,
nombre_actividad,
fecha_actividad,
} = req.body;

// [DIAGRAMA] PASO 10: El controlador ejecuta "validarCamposObligatorios()"
if (
!id_curso_materia ||
!id_dimension_eval ||
!trimestre ||
!nombre_actividad
) {
// [DIAGRAMA] Alt: EX-02 Campos obligatorios vacíos -> ejecutar mostrarError()
return res
.status(400)
.json({ message: "Todos los campos obligatorios deben ser completados" });
}

// Validación auxiliar de formato para asegurar consistencia escolar
if (trimestre < 1 || trimestre > 3) {
return res
.status(400)
.json({ message: "El trimestre debe estar entre 1 y 3" });
}

const client = await pool.connect();

try {
// Obtenemos los datos de la asignación del curso para validar permisos y gestión
const cm = await client.query(
`             SELECT cm.id_curso_materia, cm.id_curso, cm.id_profesor,
                   c.id_gestion,
                   p.id_usuario
            FROM curso_materia cm
            JOIN curso c ON c.id_curso = cm.id_curso
            JOIN profesor p ON p.id_profesor = cm.id_profesor
            WHERE cm.id_curso_materia = $1
        `,
[id_curso_materia],
);

    if (cm.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Asignacion curso-materia no encontrada" });
    }

    // Control de seguridad del Rol (Solo el profesor asignado o administradores)
    const profesorUsuarioId = cm.rows[0].id_usuario;
    if (
      req.usuario.role !== 1 &&
      req.usuario.role !== 2 &&
      profesorUsuarioId !== req.usuario.id
    ) {
      return res
        .status(403)
        .json({
          message: "No tiene permisos para registrar actividades en esta materia",
        });
    }


    // ====================================================================================
    // ⚠️ CRÍTICO: AQUÍ FALTA CÓDIGO CLAVE SEGÚN EL DIAGRAMA DE SECUENCIA ⚠️
    // ====================================================================================
    // [DIAGRAMA] PASO 3, 4 y 5: El controlador DEBE invocar "validarTrimestreAbierto()"
    // consultando a la entidad "Materias Trimestres" para verificar si el estado es abierto.
    //
    // Si la consulta indica que el trimestre está cerrado o la libreta ya fue aprobada,
    // tu código debe frenar y ejecutar de inmediato el bloque:
    // [DIAGRAMA] Alt: EX-01 Trimestre cerrado / libreta aprobada.
    //
    // Ejemplo de cómo debió implementarse:
    // const estadoTrimestre = await client.query(
    //    "SELECT estado FROM materias_trimestres WHERE id_curso_materia = $1 AND trimestre = $2",
    //    [id_curso_materia, trimestre]
    // );
    // if (estadoTrimestre.rows.length > 0 && estadoTrimestre.rows[0].estado !== 'abierto') {
    //    return res.status(400).json({ message: "El trimestre está cerrado o la libreta fue aprobada" });
    // }
    // ====================================================================================


    // Validación extra: Verificar la existencia de la dimensión académica asociada
    const dimCheck = await client.query(
      "SELECT id_dimension_eval, id_gestion FROM dimension_evaluacion WHERE id_dimension_eval = $1",
      [id_dimension_eval],
    );

    if (dimCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Dimension de evaluacion no encontrada" });
    }

    if (dimCheck.rows[0].id_gestion !== cm.rows[0].id_gestion) {
      return res
        .status(400)
        .json({ message: "La dimension no pertenece a la gestion del curso" });
    }

    await client.query("BEGIN");

    // [DIAGRAMA] PASO 11 y 12: El controlador ejecuta "crearActividadEvaluacion()"
    // insertando el registro en la entidad Actividad Evaluación y recibe "actividad registrada".
    const saved = await client.query(
      `
            INSERT INTO actividad_evaluacion (id_curso_materia, id_dimension_eval, trimestre, nombre_actividad, fecha_actividad)
            VALUES ($1, $2, $3, $4, $5::date)
            RETURNING *
        `,
      [
        id_curso_materia,
        id_dimension_eval,
        trimestre,
        nombre_actividad,
        fecha_actividad || null,
      ],
    );

    // [DIAGRAMA] PASO 13 y 14: El controlador envía "registrarEvento(datosEvento)"
    // a la Bitácora (Sistema) indicando la acción REGISTRAR ACTIVIDAD DE EVALUACIÓN.
    await registrarBitacora({
      id_usuario: req.usuario.id,
      nombre_modulo: "evaluaciones",
      nombre_permiso: "registrar_evaluaciones",
      metodo: "POST /api/actividades",
      accion: "INSERT",
      tabla_afectada: "actividad_evaluacion",
      id_registro_afectado: saved.rows[0].id_actividad,
      descripcion: `Actividad "${nombre_actividad}" creada para curso-materia ${id_curso_materia}`,
      ip_origen: getClientIp(req),
    });

    await client.query("COMMIT");

    // [DIAGRAMA] PASO 15: El controlador envía la orden de "actualizarTablaVisual(nueva_columna)" al Panel
    // [DIAGRAMA] PASO 16: Se ejecuta confirmar("Actividad registrada correctamente") enviando el JSON de éxito
    // [DIAGRAMA] POSTCONDICIÓN: La actividad queda disponible en el Panel para el ingreso de calificaciones en CU19
    res
      .status(201)
      .json({
        message: "Actividad de evaluacion registrada correctamente", //aca
        actividad: saved.rows[0],
      });

} catch (error) {
await client.query("ROLLBACK");
res
.status(500)
.json({ message: "Error al registrar actividad", error: error.message });
} finally {
client.release();
}
};

// Función auxiliar para recuperar los detalles de un registro individualizado
const obtenerActividad = async (req, res) => {
const { id } = req.params;

try {
const result = await pool.query(
`             SELECT ae.*, de.nombre_dimension, de.puntaje_maximo,
                   cm.id_curso, cm.id_materia, m.nombre_materia
            FROM actividad_evaluacion ae
            JOIN dimension_evaluacion de ON de.id_dimension_eval = ae.id_dimension_eval
            JOIN curso_materia cm ON cm.id_curso_materia = ae.id_curso_materia
            JOIN materia m ON m.id_materia = cm.id_materia
            WHERE ae.id_actividad = $1
        `,
[id],
);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Actividad no encontrada" });
    }

    res.json(result.rows[0]);

} catch (error) {
res
.status(500)
.json({ message: "Error al obtener actividad", error: error.message });
}
};

module.exports = { obtenerActividades, crearActividad, obtenerActividad };

## CU19: Registrar y modificar calificaciones

const pool = require('../config/db');
const { registrarBitacora, getClientIp } = require('../utils/bitacora');

// ──────────────────────────────────────────────────────────────────────────
// [DIAGRAMA] SUBFLUJO: Cargar Actividad y Estudiantes Activos
// ──────────────────────────────────────────────────────────────────────────
const obtenerCalificaciones = async (req, res) => {
// [DIAGRAMA] PASO 1 y 2: El profesor selecciona una actividad del Registro Pedagógico
const { id_actividad } = req.params;

    try {
        // [DIAGRAMA] PASO 3 a 3.2: El controlador invoca obtenerActividad(id_actividad) a través del servicio
        const actividad = await pool.query(`
            SELECT ae.id_actividad, ae.nombre_actividad, ae.trimestre,
                   de.nombre_dimension, de.puntaje_maximo,
                   cm.id_curso, cm.id_materia, m.nombre_materia
            FROM actividad_evaluacion ae
            JOIN dimension_evaluacion de ON de.id_dimension_eval = ae.id_dimension_eval
            JOIN curso_materia cm ON cm.id_curso_materia = ae.id_curso_materia
            JOIN materia m ON m.id_materia = cm.id_materia
            WHERE ae.id_actividad = $1
        `, [id_actividad]);

        if (actividad.rows.length === 0) {
            return res.status(404).json({ message: 'Actividad no encontrada' });
        }

        // [DIAGRAMA] PASO 3.3 y 3.4: mostrar lista de estudiantes y habilitar celdas de calificación
        // Mapeas de forma excelente el estado del alumno para el control de la UI.
        const estudiantes = await pool.query(`
            SELECT e.id_estudiante, e.nombre, e.apellido, e.ci,
                   c.id_calificacion, c.nota, c.observaciones AS obs_calificacion,
                   c.fecha_evaluacion,
                   CASE WHEN e.estado = 'retirado' THEN true ELSE false END AS bloqueado
            FROM inscripcion i
            JOIN estudiante e ON e.id_estudiante = i.id_estudiante
            LEFT JOIN calificacion c ON c.id_actividad = $1 AND c.id_estudiante = e.id_estudiante
            WHERE i.id_curso = $2
              AND i.estado = 'inscrito'
              AND e.estado IN ('activo', 'retirado')
            ORDER BY e.apellido, e.nombre
        `, [id_actividad, actividad.rows[0].id_curso]);

        res.json({
            actividad: actividad.rows[0],
            puntaje_maximo: actividad.rows[0].puntaje_maximo,
            estudiantes: estudiantes.rows
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener calificaciones', error: error.message });
    }

};

// ──────────────────────────────────────────────────────────────────────────
// [DIAGRAMA] FLUJO PRINCIPAL: Guardar Calificaciones (Masivo)
// ──────────────────────────────────────────────────────────────────────────
const guardarCalificaciones = async (req, res) => {
// [DIAGRAMA] PASO 4 y 5: El profesor ingresa las notas y ejecuta guardarCalificaciones(id_actividad, calificaciones[])
const { id_actividad } = req.params;
const { calificaciones } = req.body;

    if (!Array.isArray(calificaciones) || calificaciones.length === 0) {
        return res.status(400).json({ message: 'La lista de calificaciones es obligatoria' });
    }

    const client = await pool.connect();

    try {
        const act = await client.query(`
            SELECT ae.id_actividad, ae.id_curso_materia, de.puntaje_maximo,
                   cm.id_profesor, cm.id_curso,
                   p.id_usuario
            FROM actividad_evaluacion ae
            JOIN dimension_evaluacion de ON de.id_dimension_eval = ae.id_dimension_eval
            JOIN curso_materia cm ON cm.id_curso_materia = ae.id_curso_materia
            JOIN profesor p ON p.id_profesor = cm.id_profesor
            WHERE ae.id_actividad = $1
        `, [id_actividad]);

        if (act.rows.length === 0) {
            return res.status(404).json({ message: 'Actividad no encontrada' });
        }

        // Verificación de seguridad del Actor Iniciador (Profesor)
        const profesorUsuarioId = act.rows[0].id_usuario;
        if (req.usuario.role !== 1 && req.usuario.role !== 2 && profesorUsuarioId !== req.usuario.id) {
            return res.status(403).json({ message: 'No tiene permisos para calificar en esta actividad' });
        }

        const puntajeMaximo = act.rows[0].puntaje_maximo;

        await client.query('BEGIN');

        const resultado = [];
        for (const item of calificaciones) {
            if (!item.id_estudiante) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Cada calificacion debe incluir un estudiante' });
            }

            if (item.nota !== undefined && item.nota !== null && item.nota !== '') {
                const nota = Number(item.nota);

                // [DIAGRAMA] PASO 6 y 6.1: "validarNotas" y "Validar rango 0 - puntaje_maximo"
                if (nota < 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `La nota no puede ser negativa (estudiante ${item.id_estudiante})` });
                }
                // [DIAGRAMA] Alt: EX-01 Nota fuera de rango (Si nota > puntaje_maximo) -> lanzar Error
                if (nota > puntajeMaximo) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        message: `La nota ${nota} excede el puntaje maximo permitido (${puntajeMaximo}) para el estudiante ${item.id_estudiante}`
                    });
                }


                // [DIAGRAMA] PASO 6.4: Verificar estado del estudiante
                const estudianteCheck = await client.query(
                    "SELECT estado FROM estudiante WHERE id_estudiante = $1",
                    [item.id_estudiante]
                );

                // [DIAGRAMA] Alt: EX-02 6.4.2 Error: estudiante retirado -> 6.4.3 Bloquear ingreso de nuevas notas
                if (estudianteCheck.rows.length > 0 && estudianteCheck.rows[0].estado === 'retirado') {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        message: `Operación cancelada: El estudiante con ID ${item.id_estudiante} se encuentra en estado RETIRADO.`
                    });
                }


                // [DIAGRAMA] PASO 7 y 7.1: upsertCalificaciones() -> ON CONFLICT DO UPDATE
                const saved = await client.query(`
                    INSERT INTO calificacion (id_actividad, id_estudiante, nota, observaciones)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id_actividad, id_estudiante)
                    DO UPDATE SET nota = EXCLUDED.nota,
                                  observaciones = EXCLUDED.observaciones,
                                  fecha_evaluacion = CURRENT_DATE
                    RETURNING *
                `, [id_actividad, item.id_estudiante, nota, item.observaciones || null]);

                resultado.push(saved.rows[0]);
            }
        }

        await client.query('COMMIT');

        // [DIAGRAMA] PASO 8 y 8.1: registrarEvento("Modificar Calificaciones", id_actividad, id_usuario) en la Bitácora
        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'evaluaciones',
            nombre_permiso: 'registrar_evaluaciones',
            metodo: 'POST /api/calificaciones/actividad/:id_actividad',
            accion: 'INSERT',
            tabla_afectada: 'calificacion',
            id_registro_afectado: Number(id_actividad),
            descripcion: `Calificaciones guardadas para actividad ${id_actividad} (${resultado.length} estudiantes)`,
            ip_origen: getClientIp(req)
        });

        // [DIAGRAMA] PASO 7.3 y 9: Confirmación OK -> "Mostrar éxito y promedios actualizados"
        res.json({ message: 'Calificaciones registradas correctamente', calificaciones: resultado });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Ya existe una calificacion para este estudiante en esta actividad' });
        }
        res.status(500).json({ message: 'Error al guardar calificaciones', error: error.message });
    } finally {
        client.release();
    }

};

const obtenerCalificaciones = async (req, res) => {
const { id_actividad } = req.params;

    try {
        const actividad = await pool.query(`
            SELECT ae.id_actividad, ae.nombre_actividad, ae.trimestre,
                   de.nombre_dimension, de.puntaje_maximo,
                   cm.id_curso, cm.id_materia, m.nombre_materia
            FROM actividad_evaluacion ae
            JOIN dimension_evaluacion de ON de.id_dimension_eval = ae.id_dimension_eval
            JOIN curso_materia cm ON cm.id_curso_materia = ae.id_curso_materia
            JOIN materia m ON m.id_materia = cm.id_materia
            WHERE ae.id_actividad = $1
        `, [id_actividad]);

        if (actividad.rows.length === 0) {
            return res.status(404).json({ message: 'Actividad no encontrada' });
        }

        const estudiantes = await pool.query(`
            SELECT e.id_estudiante, e.nombre, e.apellido, e.ci,
                   c.id_calificacion, c.nota, c.observaciones AS obs_calificacion,
                   c.fecha_evaluacion,
                   CASE WHEN e.estado = 'retirado' THEN true ELSE false END AS bloqueado
            FROM inscripcion i
            JOIN estudiante e ON e.id_estudiante = i.id_estudiante
            LEFT JOIN calificacion c ON c.id_actividad = $1 AND c.id_estudiante = e.id_estudiante
            WHERE i.id_curso = $2
              AND i.estado = 'inscrito'
              AND e.estado IN ('activo', 'retirado')
            ORDER BY e.apellido, e.nombre
        `, [id_actividad, actividad.rows[0].id_curso]);

        res.json({
            actividad: actividad.rows[0],
            puntaje_maximo: actividad.rows[0].puntaje_maximo,
            estudiantes: estudiantes.rows
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener calificaciones', error: error.message });
    }

};

// [DIAGRAMA] FLUJO ALTERNATIVO / SUBFLUJO: Modificación Individual de Notas
const modificarCalificacion = async (req, res) => {
const { id } = req.params;
const { nota, observaciones, motivo } = req.body;

    if (!motivo) {
        return res.status(400).json({ message: 'El motivo de modificacion es obligatorio' });
    }

    const client = await pool.connect();

    try {
        const cal = await client.query(`
            SELECT c.id_calificacion, c.id_actividad, c.nota AS nota_actual, c.id_estudiante,
                   ae.id_curso_materia, de.puntaje_maximo,
                   cm.id_profesor, p.id_usuario
            FROM calificacion c
            JOIN actividad_evaluacion ae ON ae.id_actividad = c.id_actividad
            JOIN dimension_evaluacion de ON de.id_dimension_eval = ae.id_dimension_eval
            JOIN curso_materia cm ON cm.id_curso_materia = ae.id_curso_materia
            JOIN profesor p ON p.id_profesor = cm.id_profesor
            WHERE c.id_calificacion = $1
        `, [id]);

        if (cal.rows.length === 0) {
            return res.status(404).json({ message: 'Calificacion no encontrada' });
        }

        const profesorUsuarioId = cal.rows[0].id_usuario;
        if (req.usuario.role !== 1 && req.usuario.role !== 2 && profesorUsuarioId !== req.usuario.id) {
            return res.status(403).json({ message: 'No tiene permisos para modificar esta calificacion' });
        }

        // [DIAGRAMA] PASO 6 y 6.1: Re-validación del rango para actualizaciones unitarias
        if (nota !== undefined && nota !== null && nota !== '') {
            const notaNum = Number(nota);
            if (notaNum < 0) {
                return res.status(400).json({ message: 'La nota no puede ser negativa' });
            }
            if (notaNum > cal.rows[0].puntaje_maximo) {
                return res.status(400).json({
                    message: `La nota ${notaNum} excede el puntaje maximo permitido (${cal.rows[0].puntaje_maximo})`
                });
            }
        }

        await client.query('BEGIN');

        // Inyección automática del motivo histórico en observaciones
        const obsNueva = `[Modificado: ${motivo}] ${observaciones || ''}`.trim();

        // [DIAGRAMA] PASO 7.1: ON CONFLICT DO UPDATE adaptado a sentencia UPDATE directa
        const result = await client.query(`
            UPDATE calificacion
            SET nota = COALESCE($1, nota),
                observaciones = CASE
                    WHEN $2::text IS NOT NULL THEN $2
                    ELSE observaciones
                END,
                fecha_evaluacion = CURRENT_DATE
            WHERE id_calificacion = $3
            RETURNING *
        `, [
            nota !== undefined && nota !== null && nota !== '' ? Number(nota) : null,
            obsNueva,
            id
        ]);

        // [DIAGRAMA] PASO 8: Registro específico de auditoría con desglose de la nota previa
        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'evaluaciones',
            nombre_permiso: 'registrar_evaluaciones',
            metodo: 'PUT /api/calificaciones/:id',
            accion: 'UPDATE',
            tabla_afectada: 'calificacion',
            id_registro_afectado: Number(id),
            descripcion: `Calificacion modificada. Motivo: ${motivo}. Nota anterior: ${cal.rows[0].nota_actual}`,
            ip_origen: getClientIp(req)
        });

        await client.query('COMMIT');

        res.json({ message: 'Calificacion actualizada correctamente', calificacion: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error al modificar calificacion', error: error.message });
    } finally {
        client.release();
    }

};

module.exports = { obtenerCalificaciones, guardarCalificaciones, obtenerCalificacion, modificarCalificacion };

## CU22: Generar deudas automáticas

const pool = require('../config/db');
const { registrarBitacora, getClientIp } = require('../utils/bitacora');

//=================================IMPORTANTE=========================================//

const generarDeudasMasivas = async (req, res) => {
// 1. Recibe el periodo (id_gestion), el concepto y el mes desde el cuerpo de la petición.
// CORRECCIÓN: Se elimina 'monto' del req.body. Ahora se extrae de forma segura desde la BD.
const { id_gestion, id_concepto, mes, filtros } = req.body;

    // Validación inicial de campos obligatorios para arrancar el proceso
    if (!id_gestion || !id_concepto || !mes) {
        return res.status(400).json({ message: 'Faltan datos obligatorios: id_gestion, id_concepto, mes' });
    }

    const client = await pool.connect();
    try {
        // [DIAGRAMA] PASO 2 y 3: Inicia la transacción en el DeudaController
        await client.query('BEGIN');

        // [DIAGRAMA] PASO 3.1 a 5.1: Consultar la gestión y la lista de estudiantes inscritos y activos.
        // Se añade un JOIN estratégico a 'grado' y 'nivel_arancel' para extraer el precio automatizado de inmediato.
        let estudiantesQuery = `
            SELECT DISTINCT
                e.id_estudiante,
                e.nombre || ' ' || e.apellido AS nombre_completo,
                c.id_grado,
                g.id_nivel,
                ar.monto AS monto_arancel -- [DIAGRAMA] PASO 7.1 y 7.2: Obtiene el monto parametrizado por nivel
            FROM estudiante e
            JOIN inscripcion i ON i.id_estudiante = e.id_estudiante
            JOIN curso c ON c.id_curso = i.id_curso
            JOIN grado g ON g.id_grado = c.id_grado
            LEFT JOIN nivel_arancel ar ON ar.id_nivel = g.id_nivel AND ar.id_concepto = $2
            WHERE i.estado = 'inscrito'
              AND e.estado = 'activo'
              AND c.id_gestion = $1
        `;

        const params = [id_gestion, id_concepto];
        let idx = 3;

        // Aplicación dinámica de filtros opcionales (Nivel, Grado, Curso o Estudiantes específicos)
        if (filtros) {
            if (filtros.id_nivel) {
                estudiantesQuery += ` AND g.id_nivel = $${idx++}`;
                params.push(filtros.id_nivel);
            }
            if (filtros.id_grado) {
                estudiantesQuery += ` AND c.id_grado = $${idx++}`;
                params.push(filtros.id_grado);
            }
            if (filtros.id_curso) {
                estudiantesQuery += ` AND c.id_curso = $${idx++}`;
                params.push(filtros.id_curso);
            }
            if (filtros.ids_estudiantes && Array.isArray(filtros.ids_estudiantes)) {
                estudiantesQuery += ` AND e.id_estudiante = ANY($${idx++})`;
                params.push(filtros.ids_estudiantes);
            }
        }

        const estudiantes = await client.query(estudiantesQuery, params);

        // [DIAGRAMA] Alt [Sin estudiantes activos] -> PASO 6 y 6.1: Detener proceso y alertar
        if (estudiantes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'No hay estudiantes activos que cumplan con los filtros establecidos' });
        }

        // Contadores para estructurar el resumen final solicitado por la interfaz
        let insertados = 0;
        let omitidosPorExistencia = 0;
        let omitidosPorArancel = 0;

        // [DIAGRAMA] LOOP: Recorrer cada estudiante obtenido en la lista
        for (const row of estudiantes.rows) {
            try {
                // [DIAGRAMA] Alt [Arancel no configurado] -> PASO 7.3: Si el LEFT JOIN devolvió NULL, se omite
                if (row.monto_arancel === null || row.monto_arancel === undefined) {
                    omitidosPorArancel++;
                    console.warn(`[CU22] Estudiante ${row.nombre_completo} (ID: ${row.id_estudiante}) omitido: Arancel no configurado para su nivel.`);
                    continue; // Pasa al siguiente estudiante de la lista sin romper el bucle masivo
                }

                // [DIAGRAMA] PASO 8.1 y 8.2: Verificar de manera limpia si el estudiante ya cuenta con esta deuda
                const deudaCheck = await client.query(`
                    SELECT id_deuda FROM deuda
                    WHERE id_estudiante = $1 AND id_gestion = $2 AND id_concepto = $3 AND mes = $4
                `, [row.id_estudiante, id_gestion, id_concepto, mes]);

                // [DIAGRAMA] Alt [Deuda ya existente] -> PASO 8.3: Omitir de forma idempotente
                if (deudaCheck.rows.length > 0) {
                    omitidosPorExistencia++;
                    continue;
                }

                // [DIAGRAMA] PASO 9.1: Inserción formal de la deuda en estado 'pendiente' utilizando el monto recuperado
                await client.query(`
                    INSERT INTO deuda (id_estudiante, id_gestion, id_concepto, monto, mes, estado)
                    VALUES ($1, $2, $3, $4, $5, 'pendiente')
                `, [row.id_estudiante, id_gestion, id_concepto, row.monto_arancel, mes]);

                insertados++;

            } catch (errorBucle) {
                // Captura fallos imprevistos por fila para evitar la caída total de la operación masiva
                omitidosPorExistencia++;
                console.error(`Error procesando estudiante ID ${row.id_estudiante}:`, errorBucle.message);
            }
        }

        // [DIAGRAMA] Confirma la transacción completa de manera segura en la Base de Datos
        await client.query('COMMIT');

        // Construcción de la bitácora con los datos reales recopilados durante el procesamiento
        const descripcionBitacora = `Generación masiva autom. (${mes}): ${insertados} creadas, ` +
                                    `${omitidosPorExistencia} ya existían, ${omitidosPorArancel} sin arancel configurado.`;

        // [DIAGRAMA] PASO 10 y 10.1: Registrar el evento estructurado en el componente de Bitácora (Sistema)
        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'pagos',
            nombre_permiso: 'gestionar_pagos',
            metodo: 'POST /api/deudas/masivas',
            accion: 'INSERT',
            tabla_afectada: 'deuda',
            id_registro_afectado: null,
            descripcion: descripcionBitacora,
            ip_origen: getClientIp(req)
        });

        // [DIAGRAMA] PASO 11 y 12: Retornar el objeto con el resumen consolidado a la interfaz de usuario
        return res.json({
            message: 'Proceso de generación masiva finalizado',
            resumen: {
                nuevas_deudas: insertados,
                ya_existentes: omitidosPorExistencia,
                sin_arancel_configurado: omitidosPorArancel,
                total_procesados: insertados + omitidosPorExistencia + omitidosPorArancel
            }
        });

    } catch (error) {
        // [DIAGRAMA] Alt [Error BD en transacción] -> PASO 9.2 y 9.3: Ejecutar EXCEPTION y deshacer cambios (ROLLBACK)
        await client.query('ROLLBACK');
        console.error('Error crítico en generación masiva de deudas:', error);
        return res.status(500).json({ message: 'Error interno en generación masiva', error: error.message });
    } finally {
        // Garantiza la liberación inmediata del cliente del pool de conexiones bajo cualquier escenario
        client.release();
    }

};

//=================================IMPORTANTE=========================================//

module.exports = {
generarDeudasMasivas
};

## CU23: Registrar Pago

//modificado, el pagoController
const pool = require("../config/db");
const { registrarBitacora, getClientIp } = require("../utils/bitacora");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const getConceptos = async (\_req, res) => {
try {
const result = await pool.query(
"SELECT \* FROM concepto_pago ORDER BY nombre_concepto",
);
res.json(result.rows);
} catch (error) {
res.status(500).json({
message: "Error al obtener conceptos de pago",
error: error.message,
});
}
};

const createConcepto = async (req, res) => {
const { nombre_concepto, descripcion } = req.body;

if (!nombre_concepto) {
return res
.status(400)
.json({ message: "El nombre del concepto es obligatorio" });
}

try {
const result = await pool.query(
`             INSERT INTO concepto_pago (nombre_concepto, descripcion)
            VALUES ($1, $2)
            ON CONFLICT (nombre_concepto)
            DO UPDATE SET descripcion = EXCLUDED.descripcion
            RETURNING *
        `,
[nombre_concepto, descripcion || null],
);

    res.status(201).json({
      message: "Concepto guardado correctamente",
      concepto: result.rows[0],
    });

} catch (error) {
res
.status(500)
.json({ message: "Error al guardar concepto", error: error.message });
}
};

const getDeudas = async (req, res) => {
const { search, estado, id_estudiante, id_gestion } = req.query;

try {
const conditions = [];
const params = [];
let idx = 1;

    if (search) {
      conditions.push(
        `(e.nombre || ' ' || e.apellido ILIKE $${idx} OR e.ci ILIKE $${idx} OR cp.nombre_concepto ILIKE $${idx})`,
      );
      params.push(`%${search}%`);
      idx++;
    }
    if (estado) {
      conditions.push(`d.estado = $${idx++}`);
      params.push(estado);
    }
    if (id_estudiante) {
      conditions.push(`d.id_estudiante = $${idx++}`);
      params.push(id_estudiante);
    }
    if (id_gestion) {
      conditions.push(`d.id_gestion = $${idx++}`);
      params.push(id_gestion);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `
            SELECT
                d.id_deuda,
                d.id_estudiante,
                e.nombre || ' ' || e.apellido AS estudiante,
                e.ci AS estudiante_ci,
                d.id_gestion,
                ga.anio,
                d.id_concepto,
                cp.nombre_concepto,
                d.monto,
                d.mes,
                d.estado AS estado_deuda,
                d.fecha_generacion,
                p.id_pago,
                p.monto_pagado,
                p.metodo_pago,
                p.estado AS estado_pago,
                p.fecha_pago,
                p.observaciones
            FROM deuda d
            JOIN estudiante e ON e.id_estudiante = d.id_estudiante
            JOIN gestion_academica ga ON ga.id_gestion = d.id_gestion
            JOIN concepto_pago cp ON cp.id_concepto = d.id_concepto
            LEFT JOIN LATERAL (
                SELECT *
                FROM pago p
                WHERE p.id_deuda = d.id_deuda
                ORDER BY p.fecha_pago DESC
                LIMIT 1
            ) p ON TRUE
            ${where}
            ORDER BY d.fecha_generacion DESC, e.apellido, e.nombre
        `,
      params,
    );

    res.json(result.rows);

} catch (error) {
res
.status(500)
.json({ message: "Error al obtener deudas", error: error.message });
}
};

const createDeuda = async (req, res) => {
const { id_estudiante, id_gestion, id_concepto, monto, mes } = req.body;

if (!id_estudiante || !id_gestion || !id_concepto || !monto || !mes) {
return res
.status(400)
.json({
message: "Estudiante, gestion, concepto, monto y mes son obligatorios",
});
}

try {
const result = await pool.query(
`             INSERT INTO deuda (id_estudiante, id_gestion, id_concepto, monto, mes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `,
[id_estudiante, id_gestion, id_concepto, Number(monto), mes],
);

    await registrarBitacora({
      id_usuario: req.usuario.id,
      nombre_modulo: "pagos",
      nombre_permiso: "gestionar_pagos",
      metodo: "POST /api/pagos/deudas",
      accion: "GENERAR_DEUDA",
      tabla_afectada: "deuda",
      id_registro_afectado: result.rows[0].id_deuda,
      descripcion: `Deuda generada: mes ${mes}, monto ${monto}, estudiante ${id_estudiante}`,
      ip_origen: getClientIp(req),
    });
    res
      .status(201)
      .json({ message: "Deuda generada correctamente", deuda: result.rows[0] });

} catch (error) {
const status = error.code === "23505" ? 409 : 500;
res
.status(status)
.json({ message: "Error al generar deuda", error: error.message });
}
};

const registrarPago = async (req, res) => {
const {
id_deuda,
monto_pagado,
metodo_pago,
estado = "validado",
comprobante_url,
observaciones,
} = req.body;

if (!id_deuda || !monto_pagado || !metodo_pago) {
return res
.status(400)
.json({ message: "Deuda, monto y metodo de pago son obligatorios" });
}

const client = await pool.connect();
try {
await client.query("BEGIN");

    const deuda = await client.query(
      "SELECT id_estudiante, estado FROM deuda WHERE id_deuda = $1 FOR UPDATE",
      [id_deuda]
    );
    if (deuda.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Deuda no encontrada" });
    }

    if (deuda.rows[0].estado === "pagado") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Esta deuda ya ha sido pagada previamente" });
    }

    const result = await client.query(
      `
            INSERT INTO pago (
                id_deuda, id_estudiante, monto_pagado, metodo_pago,
                comprobante_url, estado, id_usuario_registro, observaciones
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `,
      [
        id_deuda,
        deuda.rows[0].id_estudiante,
        Number(monto_pagado),
        metodo_pago,
        comprobante_url || null,
        estado,
        req.usuario.id,
        observaciones || null,
      ],
    );

    // Si el pago entra validado directamente (Ej. pago en efectivo por ventanilla), se actualiza la deuda
    if (estado === "validado") {
      await client.query(
        "UPDATE deuda SET estado = 'pagado' WHERE id_deuda = $1",
        [id_deuda]
      );
    }

    await client.query("COMMIT");

    await registrarBitacora({
      id_usuario: req.usuario.id,
      nombre_modulo: "pagos",
      nombre_permiso: "gestionar_pagos",
      metodo: "POST /api/pagos",
      accion: "REGISTRAR_PAGO",
      tabla_afectada: "pago",
      id_registro_afectado: result.rows[0].id_pago,
      descripcion: `Registro de pago presencial para deuda ${id_deuda} (${metodo_pago})`,
      ip_origen: getClientIp(req),
    });

    res
      .status(201)
      .json({ message: "Pago registrado correctamente", pago: result.rows[0] });

} catch (error) {
await client.query("ROLLBACK");
res
.status(500)
.json({ message: "Error al registrar pago", error: error.message });
} finally {
client.release();
}
};

const validarPago = async (req, res) => {
const { id } = req.params;
const { estado } = req.body;

if (!["validado", "rechazado", "pendiente_validacion"].includes(estado)) {
return res.status(400).json({ message: "Estado de pago inválido" });
}

const client = await pool.connect();
try {
await client.query("BEGIN");

    const result = await client.query(
      "UPDATE pago SET estado = $1 WHERE id_pago = $2 RETURNING *",
      [estado, id],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Pago no encontrado" });
    }

    // Si el administrador aprueba manualmente un comprobante, cambiamos el estado de la deuda
    if (estado === "validado") {
      await client.query(
        "UPDATE deuda SET estado = 'pagado' WHERE id_deuda = $1",
        [result.rows[0].id_deuda]
      );
    }

    await client.query("COMMIT");

    res.json({
      message: "Pago actualizado correctamente",
      pago: result.rows[0],
    });

} catch (error) {
await client.query("ROLLBACK");
res
.status(500)
.json({ message: "Error al actualizar pago", error: error.message });
} finally {
client.release();
}
};

const buscarEstudiantePortal = async (req, res) => {
const { ci } = req.query;
if (!ci) return res.status(400).json({ message: "CI es requerido" });
try {
const result = await pool.query(
`SELECT id_estudiante, nombre, apellido, ci, estado
             FROM estudiante WHERE TRIM(UPPER(ci)) = TRIM(UPPER($1))`,
[ci],
);
if (result.rows.length === 0) {
return res.status(404).json({ message: "Estudiante no encontrado" });
}
res.json(result.rows[0]);
} catch (error) {
res
.status(500)
.json({ message: "Error al buscar estudiante", error: error.message });
}
};

const getDeudasPortal = async (req, res) => {
const { id_estudiante } = req.params;
try {
const result = await pool.query(
`             SELECT
                d.id_deuda,
                d.id_estudiante,
                e.nombre || ' ' || e.apellido AS estudiante,
                e.ci AS estudiante_ci,
                d.id_gestion,
                ga.anio,
                d.id_concepto,
                cp.nombre_concepto,
                d.monto,
                d.mes,
                d.estado AS estado_deuda,
                d.fecha_generacion,
                p.id_pago,
                p.monto_pagado,
                p.metodo_pago,
                p.estado AS estado_pago,
                p.fecha_pago,
                p.observaciones
            FROM deuda d
            JOIN estudiante e ON e.id_estudiante = d.id_estudiante
            JOIN gestion_academica ga ON ga.id_gestion = d.id_gestion
            JOIN concepto_pago cp ON cp.id_concepto = d.id_concepto
            LEFT JOIN LATERAL (
                SELECT * FROM pago p2
                WHERE p2.id_deuda = d.id_deuda
                ORDER BY p2.fecha_pago DESC
                LIMIT 1
            ) p ON TRUE
            WHERE d.id_estudiante = $1
            ORDER BY
                CASE d.estado WHEN 'mora' THEN 0 WHEN 'pendiente' THEN 1 ELSE 2 END,
                d.fecha_generacion DESC
        `,
[id_estudiante],
);
res.json(result.rows);
} catch (error) {
res
.status(500)
.json({ message: "Error al obtener deudas", error: error.message });
}
};

// [DIAGRAMA] CU23: Flujo de Inicio de Pago (Estudiante)
const crearPaymentIntentPortal = async (req, res) => {
const { id_deuda, id_estudiante } = req.body;
if (!id_deuda || !id_estudiante) {
return res
.status(400)
.json({ message: "id_deuda e id_estudiante son requeridos" });
}
try {
// [DIAGRAMA] PASO 3.1 y 3.2: Consultar estado actual de la deuda
const deudaResult = await pool.query(
"SELECT \* FROM deuda WHERE id_deuda = $1 AND id_estudiante = $2",
[id_deuda, id_estudiante],
);
if (deudaResult.rows.length === 0) {
return res.status(404).json({ message: "Deuda no encontrada" });
}
const deuda = deudaResult.rows[0];

    // [DIAGRAMA] ALT [Deuda ya pagada] -> PASO 4 y 4.1: Retornar error y bloquear proceso
    if (deuda.estado === "pagado") {
      return res.status(409).json({ message: "Error: La deuda ya se encuentra pagada" });
    }

    // IDEMPOTENCIA: Reutilizar un PaymentIntent de Stripe activo para evitar duplicación de cargos financieros
    const pagoExistente = await pool.query(
      `SELECT * FROM pago
             WHERE id_deuda = $1 AND metodo_pago = 'stripe' AND estado = 'pendiente'
             ORDER BY fecha_pago DESC LIMIT 1`,
      [id_deuda],
    );
    if (
      pagoExistente.rows.length > 0 &&
      pagoExistente.rows[0].id_stripe_payment
    ) {
      try {
        const pi = await stripe.paymentIntents.retrieve(
          pagoExistente.rows[0].id_stripe_payment,
        );
        if (
          [
            "requires_payment_method",
            "requires_confirmation",
            "requires_action",
          ].includes(pi.status)
        ) {
          return res.json({
            clientSecret: pi.client_secret,
            id_pago: pagoExistente.rows[0].id_pago,
          });
        }
      } catch (_) {
        /* Si el PI de Stripe ya expiró en sus servidores, el flujo catch permite crear uno nuevo */
      }
    }

    // [DIAGRAMA] PASO 5: Invocación externa a la API de Stripe para inicializar la pasarela de pago segura
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(deuda.monto) * 100), // Stripe procesa en centavos (Ej: 10.00 USD -> 1000)
      currency: "usd",
      metadata: {
        id_deuda: String(id_deuda),
        id_estudiante: String(id_estudiante),
      },
    });

    // Registrar el intento en la tabla 'pago' en estado transitorio 'pendiente'
    const pagoResult = await pool.query(
      `
            INSERT INTO pago (id_deuda, id_estudiante, monto_pagado, metodo_pago, estado, id_stripe_payment, observaciones)
            VALUES ($1, $2, $3, 'stripe', 'pendiente', $4, 'Pago iniciado vía Stripe - pendiente de confirmación webhook')
            RETURNING id_pago
        `,
      [id_deuda, id_estudiante, deuda.monto, paymentIntent.id],
    );

    // [DIAGRAMA] PASO 6: Responder de forma exitosa al cliente enviando el token seguro 'client_secret'
    res.json({
      clientSecret: paymentIntent.client_secret,
      id_pago: pagoResult.rows[0].id_pago,
    });

} catch (error) {
// [DIAGRAMA] ALT [Fallo conectividad Stripe] -> PASO 5.2 y 5.3: Captura excepciones y notifica fallo
res.status(500).json({
message: "No se pudo iniciar el proceso de pago",
error: error.message,
});
}
};

// [DIAGRAMA] Procesamiento o Validación Sincronizada (Administrador / Webhook)

const verificarPagoPortal = async (req, res) => {
const { id_pago } = req.params;
try {
const pagoResult = await pool.query(
"SELECT \* FROM pago WHERE id_pago = $1",
[id_pago],
);
if (pagoResult.rows.length === 0) {
return res.status(404).json({ message: "Pago no encontrado" });
}
const pago = pagoResult.rows[0];
if (!pago.id_stripe_payment) {
return res.json({ pago, stripeStatus: null });
}

    // [DIAGRAMA] PASO 19: Consultar el estado real de la transacción directamente desde los servidores de Stripe
    const pi = await stripe.paymentIntents.retrieve(pago.id_stripe_payment);

    // [DIAGRAMA] ALT [Exitoso] -> Verifica si Stripe liquidó el cargo y la base de datos local sigue en espera
    if (pi.status === "succeeded" && pago.estado === "pendiente") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // [DIAGRAMA] PASO 12: Actualizar el estado del pago local a 'validado'
        await client.query(
          `UPDATE pago SET estado = 'validado' WHERE id_pago = $1`,
          [id_pago],
        );

        // [DIAGRAMA] PASO 11: Modificar el estado de la deuda vinculada a 'pagado'
        await client.query(
          `UPDATE deuda SET estado = 'pagado' WHERE id_deuda = $1`,
          [pago.id_deuda],
        );

        // [DIAGRAMA] PASO 13 y 13.1: Auditoría obligatoria. Registrar el evento en el componente de Bitácora
        await registrarBitacora({
          id_usuario: req.usuario ? req.usuario.id : null, // Detecta si es sincronización manual o webhook autónomo
          nombre_modulo: "portal_pagos",
          nombre_permiso: "pago_publico",
          metodo: "GET /api/pagos/portal/verificar",
          accion: "CONFIRMAR_PAGO_STRIPE",
          tabla_afectada: "pago",
          id_registro_afectado: Number(id_pago),
          descripcion: `Pago Stripe validado correctamente. Identificador PI: ${pago.id_stripe_payment}`,
          ip_origen: getClientIp(req) || "0.0.0.0",
        });

        await client.query("COMMIT");
        pago.estado = "validado"; // Sincroniza la instancia en memoria para la respuesta final HTTP
      } catch (err) {
        // [DIAGRAMA] Asegura que cualquier fallo intermedio revierta los cambios parciales por seguridad
        await client.query("ROLLBACK");
        throw err; // Re-lanza el error para ser capturado en el bloque general externo
      } finally {
        client.release();
      }
    }

    // [DIAGRAMA] Retorna el objeto actualizado junto con el estatus crudo de Stripe para control visual de interfaz
    res.json({ pago, stripeStatus: pi.status });

} catch (error) {
res
.status(500)
.json({ message: "Error al verificar y consolidar el pago", error: error.message });
}
};

module.exports = {
getConceptos,
createConcepto,
getDeudas,
createDeuda,
registrarPago,
validarPago,
buscarEstudiantePortal,
getDeudasPortal,
crearPaymentIntentPortal,
verificarPagoPortal,
};

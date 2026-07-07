const pool = require("../config/db");
const { registrarBitacora, getClientIp } = require("../utils/bitacora");

//=================================IMPORTANTE=========================================//

const generarDeudasMasivas = async (req, res) => {
  // 1. Recibe el periodo (id_gestion), el concepto y el mes desde el cuerpo de la petición.
  // CORRECCIÓN: Se elimina 'monto' del req.body. Ahora se extrae de forma segura desde la BD.
  const { id_gestion, id_concepto, mes, filtros } = req.body;

  // Validación inicial de campos obligatorios para arrancar el proceso
  if (!id_gestion || !id_concepto || !mes) {
    return res.status(400).json({
      message: "Faltan datos obligatorios: id_gestion, id_concepto, mes",
    });
  }

  const client = await pool.connect();
  try {
    // [DIAGRAMA] PASO 2 y 3: Inicia la transacción en el DeudaController
    await client.query("BEGIN");

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
      await client.query("ROLLBACK");
      return res.status(404).json({
        message:
          "No hay estudiantes activos que cumplan con los filtros establecidos",
      });
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
          console.warn(
            `[CU22] Estudiante ${row.nombre_completo} (ID: ${row.id_estudiante}) omitido: Arancel no configurado para su nivel.`,
          );
          continue; // Pasa al siguiente estudiante de la lista sin romper el bucle masivo
        }

        // [DIAGRAMA] PASO 8.1 y 8.2: Verificar de manera limpia si el estudiante ya cuenta con esta deuda
        const deudaCheck = await client.query(
          `
                    SELECT id_deuda FROM deuda
                    WHERE id_estudiante = $1 AND id_gestion = $2 AND id_concepto = $3 AND mes = $4
                `,
          [row.id_estudiante, id_gestion, id_concepto, mes],
        );

        // [DIAGRAMA] Alt [Deuda ya existente] -> PASO 8.3: Omitir de forma idempotente
        if (deudaCheck.rows.length > 0) {
          omitidosPorExistencia++;
          continue;
        }

        // [DIAGRAMA] PASO 9.1: Inserción formal de la deuda en estado 'pendiente' utilizando el monto recuperado
        await client.query(
          `
                    INSERT INTO deuda (id_estudiante, id_gestion, id_concepto, monto, mes, estado)
                    VALUES ($1, $2, $3, $4, $5, 'pendiente')
                `,
          [row.id_estudiante, id_gestion, id_concepto, row.monto_arancel, mes],
        );

        insertados++;
      } catch (errorBucle) {
        // Captura fallos imprevistos por fila para evitar la caída total de la operación masiva
        omitidosPorExistencia++;
        console.error(
          `Error procesando estudiante ID ${row.id_estudiante}:`,
          errorBucle.message,
        );
      }
    }

    // [DIAGRAMA] Confirma la transacción completa de manera segura en la Base de Datos
    await client.query("COMMIT");

    // Construcción de la bitácora con los datos reales recopilados durante el procesamiento
    const descripcionBitacora =
      `Generación masiva autom. (${mes}): ${insertados} creadas, ` +
      `${omitidosPorExistencia} ya existían, ${omitidosPorArancel} sin arancel configurado.`;

    // [DIAGRAMA] PASO 10 y 10.1: Registrar el evento estructurado en el componente de Bitácora (Sistema)
    await registrarBitacora({
      id_usuario: req.usuario.id,
      nombre_modulo: "pagos",
      nombre_permiso: "gestionar_pagos",
      metodo: "POST /api/deudas/masivas",
      accion: "INSERT",
      tabla_afectada: "deuda",
      id_registro_afectado: null,
      descripcion: descripcionBitacora,
      ip_origen: getClientIp(req),
    });

    // [DIAGRAMA] PASO 11 y 12: Retornar el objeto con el resumen consolidado a la interfaz de usuario
    return res.json({
      message: "Proceso de generación masiva finalizado",
      resumen: {
        nuevas_deudas: insertados,
        ya_existentes: omitidosPorExistencia,
        sin_arancel_configurado: omitidosPorArancel,
        total_procesados:
          insertados + omitidosPorExistencia + omitidosPorArancel,
      },
    });
  } catch (error) {
    // [DIAGRAMA] Alt [Error BD en transacción] -> PASO 9.2 y 9.3: Ejecutar EXCEPTION y deshacer cambios (ROLLBACK)
    await client.query("ROLLBACK");
    console.error("Error crítico en generación masiva de deudas:", error);
    return res.status(500).json({
      message: "Error interno en generación masiva",
      error: error.message,
    });
  } finally {
    // Garantiza la liberación inmediata del cliente del pool de conexiones bajo cualquier escenario
    client.release();
  }
};
module.exports = {
  generarDeudasMasivas,
};

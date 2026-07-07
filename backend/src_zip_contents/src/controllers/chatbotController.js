const pool = require('../config/db');
const { generarContenido, GeminiError } = require('../utils/gemini');
const { construirSystemPrompt } = require('../utils/dbSchema');
const { generarReportePdf } = require('../utils/reportePdf');
const { registrarBitacora, getClientIp } = require('../utils/bitacora');

// Palabras prohibidas que invalidan una consulta (mutaciones / DDL / múltiples sentencias)
const PALABRAS_PROHIBIDAS = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|copy|call|do|begin|commit|rollback|vacuum|analyze)\b/i;

function limpiarSql(sqlRaw) {
    let sql = (sqlRaw || '').trim();
    // Quitar cercos de markdown si Gemini los incluyó
    sql = sql.replace(/^```sql/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    // Quitar punto y coma final
    sql = sql.replace(/;\s*$/, '').trim();
    return sql;
}

// Devuelve { ok, sql } o { ok:false, motivo }
function validarSelect(sqlRaw) {
    const sql = limpiarSql(sqlRaw);
    if (!sql) return { ok: false, motivo: 'vacía' };
    // Debe iniciar con SELECT o WITH
    if (!/^\s*(select|with)\b/i.test(sql)) return { ok: false, motivo: 'no_select' };
    // No permitir múltiples sentencias
    if (sql.includes(';')) return { ok: false, motivo: 'multiple' };
    // No permitir palabras de mutación
    if (PALABRAS_PROHIBIDAS.test(sql)) return { ok: false, motivo: 'mutacion' };
    // Forzar LIMIT
    let sqlFinal = sql;
    if (!/\blimit\b/i.test(sqlFinal)) sqlFinal += ' LIMIT 200';
    return { ok: true, sql: sqlFinal };
}

async function ejecutarSelectSeguro(sql) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SET TRANSACTION READ ONLY');
        await client.query("SET LOCAL statement_timeout = '8000'");
        const result = await client.query(sql);
        await client.query('ROLLBACK');
        return result;
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) { /* noop */ }
        throw err;
    } finally {
        client.release();
    }
}

function logBitacora(req, { accion, descripcion }) {
    return registrarBitacora({
        id_usuario: req.usuario?.id || null,
        nombre_modulo: 'Chatbot',
        accion,
        tabla_afectada: null,
        descripcion,
        ip_origen: getClientIp(req),
    });
}

// POST /api/chatbot/consultar  { pregunta }
const consultar = async (req, res) => {
    const { pregunta } = req.body;

    if (!pregunta || typeof pregunta !== 'string' || pregunta.trim().length < 2) {
        return res.status(400).json({ message: 'Escribe una pregunta válida.' });
    }
    if (pregunta.length > 500) {
        return res.status(400).json({ message: 'La pregunta es demasiado larga.' });
    }

    let parsed;
    try {
        const respuestaIA = await generarContenido({
            systemPrompt: construirSystemPrompt(),
            userPrompt: pregunta.trim(),
            json: true,
        });
        parsed = JSON.parse(respuestaIA);
    } catch (error) {
        // EX3: error de la API de Gemini (o JSON inválido)
        await logBitacora(req, { accion: 'SISTEMA', descripcion: `Error Gemini/Chatbot: ${error.message}. Pregunta: "${pregunta.slice(0, 120)}"` });
        const status = error instanceof GeminiError ? error.status : 502;
        return res.status(status >= 500 ? 503 : status).json({
            tipo: 'error',
            message: 'El asistente no está disponible en este momento. Por favor, intente de nuevo más tarde.',
        });
    }

    // EX2: pregunta fuera de alcance
    if (parsed.fuera_de_alcance || !parsed.sql) {
        await logBitacora(req, { accion: 'CONSULTA', descripcion: `Consulta fuera de alcance: "${pregunta.slice(0, 120)}"` });
        return res.json({
            tipo: 'fuera_alcance',
            message: 'No pude entender tu consulta o está fuera del alcance del sistema. Intenta con preguntas relacionadas a estudiantes, cursos, pagos, inventario o entregas.',
        });
    }

    // EX5: validación de seguridad (solo SELECT)
    const validacion = validarSelect(parsed.sql);
    if (!validacion.ok) {
        await logBitacora(req, { accion: 'CONSULTA', descripcion: `Consulta bloqueada (${validacion.motivo}): "${pregunta.slice(0, 120)}" | SQL: ${String(parsed.sql).slice(0, 200)}` });
        return res.status(400).json({
            tipo: 'bloqueada',
            message: 'Tu consulta no pudo ser procesada.',
        });
    }

    // Ejecutar consulta
    let result;
    try {
        result = await ejecutarSelectSeguro(validacion.sql);
    } catch (error) {
        await logBitacora(req, { accion: 'SISTEMA', descripcion: `Error al ejecutar SQL del chatbot: ${error.message} | SQL: ${validacion.sql.slice(0, 200)}` });
        return res.status(500).json({
            tipo: 'error',
            message: 'El asistente no está disponible en este momento. Por favor, intente de nuevo más tarde.',
        });
    }

    const columnas = result.fields.map((f) => f.name);
    const filas = result.rows;

    await logBitacora(req, { accion: 'CONSULTA', descripcion: `Consulta chatbot: "${pregunta.slice(0, 120)}" → ${filas.length} fila(s).` });

    // EX4: resultado vacío
    if (filas.length === 0) {
        return res.json({
            tipo: 'vacio',
            titulo: parsed.titulo || 'Consulta',
            message: 'No encontré registros que coincidan con tu consulta para los parámetros indicados.',
            columnas: [],
            filas: [],
        });
    }

    res.json({
        tipo: 'ok',
        titulo: parsed.titulo || 'Resultado',
        respuesta: parsed.respuesta_texto || '',
        es_listado: parsed.es_listado !== false && filas.length > 1,
        columnas,
        filas,
    });
};

// ── Exportación de resultados del chatbot ───────────────────────────────────────

function escaparCsv(val) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

// POST /api/chatbot/exportar  { titulo, columnas, filas, formato }
const exportar = async (req, res) => {
    const { titulo = 'Consulta', columnas, filas, formato = 'pdf' } = req.body;

    if (!Array.isArray(columnas) || !Array.isArray(filas) || filas.length === 0) {
        return res.status(400).json({ message: 'No hay datos para exportar.' });
    }

    try {
        const safeTitulo = String(titulo).slice(0, 80);
        const filename = `chatbot_${safeTitulo.replace(/[^a-z0-9]+/gi, '_').toLowerCase().slice(0, 40) || 'consulta'}`;

        if (formato === 'csv') {
            const cab = columnas.map(escaparCsv).join(',');
            const cuerpo = filas.map((fila) =>
                columnas.map((c) => escaparCsv(fila[c])).join(','),
            ).join('\n');
            const csv = '﻿' + cab + '\n' + cuerpo; // BOM para Excel
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
            res.send(csv);
        } else {
            const anchoFrac = 1 / columnas.length;
            generarReportePdf(res, {
                filename: `${filename}.pdf`,
                titulo: safeTitulo,
                subtitulo: `Consulta del asistente — ${filas.length} registro(s)`,
                secciones: [{
                    tipo: 'tabla',
                    columnas: columnas.map((c) => ({ header: c, key: c, width: anchoFrac })),
                    filas,
                }],
                landscape: columnas.length > 5,
            });
        }

        await logBitacora(req, { accion: 'EXPORTACION', descripcion: `Exportación de consulta chatbot "${safeTitulo}" (${formato.toUpperCase()}). ${filas.length} fila(s).` });
    } catch (error) {
        if (!res.headersSent) res.status(500).json({ message: 'Error al exportar el resultado.' });
    }
};

module.exports = { consultar, exportar };

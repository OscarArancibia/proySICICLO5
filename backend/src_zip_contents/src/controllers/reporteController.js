const pool = require('../config/db');
const { generarReportePdf } = require('../utils/reportePdf');
const { generarReporteExcel } = require('../utils/reporteExcel');
const { registrarBitacora, getClientIp } = require('../utils/bitacora');

// ── Helpers ────────────────────────────────────────────────────────────────────

const MENSAJE_SIN_DATOS =
    'No se encontraron datos para los filtros seleccionados. Ajuste los parámetros e intente de nuevo.';
const MENSAJE_ERROR =
    'Ocurrió un error al generar el reporte. Por favor, inténtelo de nuevo.';

// Construye cláusula WHERE dinámica. conds: [{ sql: 'campo = ?', value }]
function buildWhere(conds) {
    const activos = conds.filter((c) => c.value !== undefined && c.value !== null && c.value !== '');
    const params = [];
    const sql = activos
        .map((c) => {
            params.push(c.value);
            return c.sql.replace('?', `$${params.length}`);
        })
        .join(' AND ');
    return { where: sql ? `WHERE ${sql}` : '', params };
}

async function bitacoraExportacion(req, { tabla, descripcion }) {
    await registrarBitacora({
        id_usuario: req.usuario?.id || null,
        nombre_modulo: 'Reportes',
        accion: 'EXPORTACION',
        tabla_afectada: tabla,
        descripcion,
        ip_origen: getClientIp(req),
    });
}

async function bitacoraSistema(req, descripcion) {
    await registrarBitacora({
        id_usuario: req.usuario?.id || null,
        nombre_modulo: 'Reportes',
        accion: 'SISTEMA',
        descripcion,
        ip_origen: getClientIp(req),
    });
}

// Genera columnas para PDF (width = fracción) y Excel (xw = ancho en caracteres)
function pdfCols(defs) {
    return defs.map((d) => ({ header: d.header, key: d.key, width: d.w, align: d.align }));
}
function xlsxCols(defs) {
    return defs.map((d) => ({ header: d.header, key: d.key, width: d.xw || 20 }));
}

// Despacha la entrega del archivo según el formato y registra la bitácora.
async function entregar(req, res, { formato, filename, titulo, subtitulo, filtros, columnas, filas, secciones, landscape, tabla, descripcion, hojaNombre }) {
    if (formato === 'excel') {
        await generarReporteExcel(res, {
            filename: `${filename}.xlsx`,
            titulo,
            subtitulo,
            filtros,
            hojas: [{ nombre: hojaNombre || 'Reporte', columnas: xlsxCols(columnas), filas }],
        });
    } else {
        generarReportePdf(res, {
            filename: `${filename}.pdf`,
            titulo,
            subtitulo,
            filtros,
            landscape,
            secciones: secciones || [{ tipo: 'tabla', columnas: pdfCols(columnas), filas }],
        });
    }
    await bitacoraExportacion(req, { tabla, descripcion });
}

function nivelTexto(id, niveles) {
    if (!id) return 'Todos';
    const n = niveles?.find((x) => String(x.id_nivel) === String(id));
    return n ? n.nombre_nivel : `Nivel ${id}`;
}

// ── 1. Reporte de Estudiantes (PDF/Excel) ──────────────────────────────────────

const reporteEstudiantes = async (req, res) => {
    const { formato = 'pdf', id_gestion, id_nivel, id_curso, estado } = req.query;
    try {
        const { where, params } = buildWhere([
            { sql: 'c.id_gestion = ?', value: id_gestion },
            { sql: 'n.id_nivel = ?', value: id_nivel },
            { sql: 'c.id_curso = ?', value: id_curso },
            { sql: 'e.estado = ?', value: estado },
        ]);

        const { rows } = await pool.query(`
            SELECT e.id_estudiante, e.nombre, e.apellido, e.ci, e.genero, e.edad, e.estado,
                   COALESCE(n.nombre_nivel, '—') AS nombre_nivel,
                   COALESCE(g.nombre_grado, '—') AS nombre_grado,
                   COALESCE(c.paralelo, '—')     AS paralelo,
                   COALESCE(c.turno, '—')        AS turno,
                   gest.anio,
                   i.fecha_inscripcion
            FROM estudiante e
            LEFT JOIN inscripcion i ON i.id_estudiante = e.id_estudiante AND i.estado = 'inscrito'
            LEFT JOIN curso c ON c.id_curso = i.id_curso
            LEFT JOIN grado g ON g.id_grado = c.id_grado
            LEFT JOIN nivel n ON n.id_nivel = g.id_nivel
            LEFT JOIN gestion_academica gest ON gest.id_gestion = c.id_gestion
            ${where}
            ORDER BY e.apellido, e.nombre
        `, params);

        if (rows.length === 0) return res.status(404).json({ message: MENSAJE_SIN_DATOS });

        const filas = rows.map((r) => ({
            ...r,
            nombre_completo: `${r.apellido} ${r.nombre}`,
            fecha_inscripcion: r.fecha_inscripcion
                ? new Date(r.fecha_inscripcion).toLocaleDateString('es-BO') : '—',
        }));

        const columnas = [
            { header: '#', key: 'id_estudiante', w: 0.06, xw: 6, align: 'center' },
            { header: 'Estudiante', key: 'nombre_completo', w: 0.22, xw: 30 },
            { header: 'CI', key: 'ci', w: 0.1, xw: 14 },
            { header: 'Género', key: 'genero', w: 0.1, xw: 12 },
            { header: 'Nivel', key: 'nombre_nivel', w: 0.12, xw: 14 },
            { header: 'Grado', key: 'nombre_grado', w: 0.12, xw: 16 },
            { header: 'Paralelo', key: 'paralelo', w: 0.08, xw: 9, align: 'center' },
            { header: 'Turno', key: 'turno', w: 0.1, xw: 10 },
            { header: 'Estado', key: 'estado', w: 0.1, xw: 12 },
        ];

        await entregar(req, res, {
            formato,
            filename: 'reporte_estudiantes',
            titulo: 'Reporte de Estudiantes',
            subtitulo: `${filas.length} estudiante(s)`,
            filtros: filtrosLegibles(req, { Nivel: id_nivel ? nivelTexto(id_nivel, req._niveles) : null, Estado: estado }),
            columnas, filas, landscape: true,
            tabla: 'estudiante', hojaNombre: 'Estudiantes',
            descripcion: `Reporte de Estudiantes (${formato.toUpperCase()}). Filtros: ${JSON.stringify({ id_gestion, id_nivel, id_curso, estado })}. Total: ${filas.length}.`,
        });
    } catch (error) {
        await bitacoraSistema(req, `Error en Reporte de Estudiantes: ${error.message}`);
        if (!res.headersSent) res.status(500).json({ message: MENSAJE_ERROR });
    }
};

// ── 2. Reporte de Pagos (PDF/Excel) ─────────────────────────────────────────────

const reportePagos = async (req, res) => {
    const { formato = 'pdf', id_gestion, estado_deuda, mes } = req.query;
    try {
        const { where, params } = buildWhere([
            { sql: 'd.id_gestion = ?', value: id_gestion },
            { sql: 'd.estado = ?', value: estado_deuda },
            { sql: 'd.mes = ?', value: mes },
        ]);

        const { rows } = await pool.query(`
            SELECT e.nombre, e.apellido, e.ci,
                   cp.nombre_concepto, d.mes, d.monto, d.estado AS estado_deuda, gest.anio,
                   COALESCE(SUM(p.monto_pagado) FILTER (WHERE p.estado = 'validado'), 0) AS pagado
            FROM deuda d
            JOIN estudiante e    ON e.id_estudiante = d.id_estudiante
            JOIN concepto_pago cp ON cp.id_concepto = d.id_concepto
            JOIN gestion_academica gest ON gest.id_gestion = d.id_gestion
            LEFT JOIN pago p ON p.id_deuda = d.id_deuda
            ${where}
            GROUP BY e.nombre, e.apellido, e.ci, cp.nombre_concepto, d.mes, d.monto, d.estado, gest.anio
            ORDER BY e.apellido, e.nombre, d.mes
        `, params);

        if (rows.length === 0) return res.status(404).json({ message: MENSAJE_SIN_DATOS });

        let totalDeuda = 0, totalPagado = 0;
        const filas = rows.map((r) => {
            const monto = parseFloat(r.monto), pagado = parseFloat(r.pagado);
            totalDeuda += monto; totalPagado += pagado;
            return {
                estudiante: `${r.apellido} ${r.nombre}`,
                ci: r.ci, nombre_concepto: r.nombre_concepto, mes: r.mes,
                monto: monto.toFixed(2), pagado: pagado.toFixed(2),
                saldo: (monto - pagado).toFixed(2),
                estado_deuda: r.estado_deuda,
            };
        });

        const columnas = [
            { header: 'Estudiante', key: 'estudiante', w: 0.24, xw: 30 },
            { header: 'CI', key: 'ci', w: 0.1, xw: 14 },
            { header: 'Concepto', key: 'nombre_concepto', w: 0.18, xw: 22 },
            { header: 'Mes', key: 'mes', w: 0.1, xw: 12 },
            { header: 'Monto (Bs)', key: 'monto', w: 0.1, xw: 12, align: 'right' },
            { header: 'Pagado (Bs)', key: 'pagado', w: 0.1, xw: 12, align: 'right' },
            { header: 'Saldo (Bs)', key: 'saldo', w: 0.1, xw: 12, align: 'right' },
            { header: 'Estado', key: 'estado_deuda', w: 0.1, xw: 12 },
        ];

        const secciones = [
            { tipo: 'stats', titulo: 'Resumen', items: [
                ['Total deuda', `Bs ${totalDeuda.toFixed(2)}`],
                ['Total pagado', `Bs ${totalPagado.toFixed(2)}`],
                ['Saldo pendiente', `Bs ${(totalDeuda - totalPagado).toFixed(2)}`],
                ['Registros', String(filas.length)],
            ] },
            { tipo: 'tabla', titulo: 'Detalle de Deudas y Pagos', columnas: pdfCols(columnas), filas },
        ];

        await entregar(req, res, {
            formato,
            filename: 'reporte_pagos',
            titulo: 'Reporte de Pagos',
            subtitulo: `${filas.length} registro(s)`,
            filtros: filtrosLegibles(req, { 'Estado deuda': estado_deuda, Mes: mes }),
            columnas, filas, secciones, landscape: true,
            tabla: 'deuda', hojaNombre: 'Pagos',
            descripcion: `Reporte de Pagos (${formato.toUpperCase()}). Filtros: ${JSON.stringify({ id_gestion, estado_deuda, mes })}. Total: ${filas.length}.`,
        });
    } catch (error) {
        await bitacoraSistema(req, `Error en Reporte de Pagos: ${error.message}`);
        if (!res.headersSent) res.status(500).json({ message: MENSAJE_ERROR });
    }
};

// ── 3. Reporte de Inventario (solo PDF) ─────────────────────────────────────────

const reporteInventario = async (req, res) => {
    const { formato = 'pdf', categoria, estado, stock_bajo } = req.query;
    try {
        const conds = [
            { sql: 'm.categoria = ?', value: categoria },
            { sql: 'm.estado = ?', value: estado === undefined || estado === '' ? undefined : estado === 'true' || estado === 'activo' },
        ];
        if (stock_bajo === 'true') conds.push({ sql: 'm.stock_actual <= m.stock_minimo', value: '__raw__' });
        // El filtro stock_bajo no usa parámetro: lo añadimos manualmente
        const { where, params } = buildWhere(conds.filter((c) => c.value !== '__raw__'));
        let whereFinal = where;
        if (stock_bajo === 'true') {
            whereFinal = where ? `${where} AND m.stock_actual <= m.stock_minimo` : 'WHERE m.stock_actual <= m.stock_minimo';
        }

        const { rows } = await pool.query(`
            SELECT m.nombre_item, m.categoria, m.descripcion,
                   m.stock_actual, m.stock_minimo, m.estado,
                   (m.stock_actual <= m.stock_minimo) AS bajo
            FROM material m
            ${whereFinal}
            ORDER BY (m.stock_actual <= m.stock_minimo) DESC, m.categoria, m.nombre_item
        `, params);

        if (rows.length === 0) return res.status(404).json({ message: MENSAJE_SIN_DATOS });

        const bajos = rows.filter((r) => r.bajo).length;
        const filas = rows.map((r) => ({
            nombre_item: r.nombre_item,
            categoria: r.categoria,
            stock_actual: r.stock_actual,
            stock_minimo: r.stock_minimo,
            estado: r.estado ? 'Activo' : 'Inactivo',
            alerta: r.bajo ? 'STOCK BAJO' : 'OK',
        }));

        const columnas = [
            { header: 'Material', key: 'nombre_item', w: 0.3, xw: 32 },
            { header: 'Categoría', key: 'categoria', w: 0.2, xw: 20 },
            { header: 'Stock actual', key: 'stock_actual', w: 0.12, xw: 12, align: 'center' },
            { header: 'Stock mínimo', key: 'stock_minimo', w: 0.12, xw: 12, align: 'center' },
            { header: 'Estado', key: 'estado', w: 0.13, xw: 12 },
            { header: 'Alerta', key: 'alerta', w: 0.13, xw: 14, align: 'center' },
        ];

        const secciones = [
            { tipo: 'stats', titulo: 'Resumen', items: [
                ['Materiales', String(rows.length)],
                ['Con stock bajo', String(bajos)],
            ] },
            { tipo: 'tabla', titulo: 'Inventario de Materiales', columnas: pdfCols(columnas), filas },
        ];

        await entregar(req, res, {
            formato: 'pdf',
            filename: 'reporte_inventario',
            titulo: 'Reporte de Inventario',
            subtitulo: `${rows.length} material(es)`,
            filtros: filtrosLegibles(req, { Categoría: categoria, 'Solo stock bajo': stock_bajo === 'true' ? 'Sí' : null }),
            columnas, filas, secciones,
            tabla: 'material',
            descripcion: `Reporte de Inventario (PDF). Filtros: ${JSON.stringify({ categoria, estado, stock_bajo })}. Total: ${rows.length}.`,
        });
    } catch (error) {
        await bitacoraSistema(req, `Error en Reporte de Inventario: ${error.message}`);
        if (!res.headersSent) res.status(500).json({ message: MENSAJE_ERROR });
    }
};

// ── 4. Reporte de Calificaciones (PDF/Excel) ────────────────────────────────────

const reporteCalificaciones = async (req, res) => {
    const { formato = 'pdf', id_gestion, id_materia, trimestre, dimension } = req.query;
    try {
        const { where, params } = buildWhere([
            { sql: 'gest.id_gestion = ?', value: id_gestion },
            { sql: 'cm.id_materia = ?', value: id_materia },
            { sql: 'ae.trimestre = ?', value: trimestre },
            { sql: 'de.nombre_dimension = ?', value: dimension },
        ]);

        const { rows } = await pool.query(`
            SELECT e.nombre, e.apellido,
                   m.nombre_materia, ae.trimestre, de.nombre_dimension, de.puntaje_maximo,
                   g.nombre_grado, c.paralelo, gest.anio,
                   SUM(cal.nota) AS obtenido
            FROM calificacion cal
            JOIN actividad_evaluacion ae ON ae.id_actividad      = cal.id_actividad
            JOIN dimension_evaluacion de ON de.id_dimension_eval = ae.id_dimension_eval
            JOIN curso_materia cm        ON cm.id_curso_materia   = ae.id_curso_materia
            JOIN materia m               ON m.id_materia          = cm.id_materia
            JOIN curso c                 ON c.id_curso            = cm.id_curso
            JOIN grado g                 ON g.id_grado            = c.id_grado
            JOIN gestion_academica gest  ON gest.id_gestion       = c.id_gestion
            JOIN estudiante e            ON e.id_estudiante       = cal.id_estudiante
            ${where}
            GROUP BY e.nombre, e.apellido, m.nombre_materia, ae.trimestre,
                     de.nombre_dimension, de.puntaje_maximo, g.nombre_grado, c.paralelo, gest.anio
            ORDER BY m.nombre_materia, ae.trimestre, e.apellido, e.nombre
        `, params);

        if (rows.length === 0) return res.status(404).json({ message: MENSAJE_SIN_DATOS });

        const filas = rows.map((r) => ({
            estudiante: `${r.apellido} ${r.nombre}`,
            nombre_materia: r.nombre_materia,
            curso: `${r.nombre_grado} ${r.paralelo}`,
            trimestre: `T${r.trimestre}`,
            nombre_dimension: r.nombre_dimension,
            puntaje_maximo: parseFloat(r.puntaje_maximo).toFixed(2),
            obtenido: parseFloat(r.obtenido).toFixed(2),
        }));

        const columnas = [
            { header: 'Estudiante', key: 'estudiante', w: 0.24, xw: 30 },
            { header: 'Materia', key: 'nombre_materia', w: 0.2, xw: 24 },
            { header: 'Curso', key: 'curso', w: 0.14, xw: 16 },
            { header: 'Trim.', key: 'trimestre', w: 0.08, xw: 8, align: 'center' },
            { header: 'Dimensión', key: 'nombre_dimension', w: 0.14, xw: 16 },
            { header: 'Punt. Máx.', key: 'puntaje_maximo', w: 0.1, xw: 12, align: 'right' },
            { header: 'Obtenido', key: 'obtenido', w: 0.1, xw: 12, align: 'right' },
        ];

        await entregar(req, res, {
            formato,
            filename: 'reporte_calificaciones',
            titulo: 'Reporte de Calificaciones',
            subtitulo: `${filas.length} registro(s)`,
            filtros: filtrosLegibles(req, { Trimestre: trimestre, Dimensión: dimension }),
            columnas, filas, landscape: true,
            tabla: 'calificacion', hojaNombre: 'Calificaciones',
            descripcion: `Reporte de Calificaciones (${formato.toUpperCase()}). Filtros: ${JSON.stringify({ id_gestion, id_materia, trimestre, dimension })}. Total: ${filas.length}.`,
        });
    } catch (error) {
        await bitacoraSistema(req, `Error en Reporte de Calificaciones: ${error.message}`);
        if (!res.headersSent) res.status(500).json({ message: MENSAJE_ERROR });
    }
};

// ── 5. Reporte de Entregas (solo PDF) ───────────────────────────────────────────

const reporteEntregas = async (req, res) => {
    const { fecha_inicio, fecha_fin, id_supervisor } = req.query;
    try {
        const { where, params } = buildWhere([
            { sql: 'ee.fecha_hora_entrega::date >= ?', value: fecha_inicio },
            { sql: 'ee.fecha_hora_entrega::date <= ?', value: fecha_fin },
            { sql: 'ee.id_usuario_supervisor = ?', value: id_supervisor },
        ]);

        const { rows } = await pool.query(`
            SELECT ee.fecha_hora_entrega,
                   e.nombre AS est_nombre, e.apellido AS est_apellido, e.ci,
                   t.nombre AS tut_nombre, t.apellido AS tut_apellido, te.parentesco,
                   COALESCE(ps.nombre || ' ' || ps.apellido, u.username) AS supervisor,
                   ee.observaciones
            FROM entrega_estudiante ee
            JOIN estudiante e ON e.id_estudiante = ee.id_estudiante
            JOIN tutor t      ON t.id_tutor      = ee.id_tutor
            LEFT JOIN tutor_estudiante te ON te.id_tutor = ee.id_tutor AND te.id_estudiante = ee.id_estudiante
            JOIN usuario u    ON u.id_usuario    = ee.id_usuario_supervisor
            LEFT JOIN profesor ps ON ps.id_usuario = ee.id_usuario_supervisor
            ${where}
            ORDER BY ee.fecha_hora_entrega DESC
        `, params);

        if (rows.length === 0) return res.status(404).json({ message: MENSAJE_SIN_DATOS });

        const filas = rows.map((r) => ({
            fecha: new Date(r.fecha_hora_entrega).toLocaleString('es-BO'),
            estudiante: `${r.est_apellido} ${r.est_nombre}`,
            ci: r.ci,
            tutor: `${r.tut_apellido} ${r.tut_nombre}`,
            parentesco: r.parentesco,
            supervisor: r.supervisor,
            observaciones: r.observaciones,
        }));

        const columnas = [
            { header: 'Fecha/Hora', key: 'fecha', w: 0.18 },
            { header: 'Estudiante', key: 'estudiante', w: 0.18 },
            { header: 'CI', key: 'ci', w: 0.09 },
            { header: 'Tutor', key: 'tutor', w: 0.16 },
            { header: 'Parentesco', key: 'parentesco', w: 0.11 },
            { header: 'Supervisor', key: 'supervisor', w: 0.14 },
            { header: 'Obs.', key: 'observaciones', w: 0.14 },
        ];

        await entregar(req, res, {
            formato: 'pdf',
            filename: 'reporte_entregas',
            titulo: 'Reporte de Entregas Seguras',
            subtitulo: `${filas.length} entrega(s)`,
            filtros: filtrosLegibles(req, { Desde: fecha_inicio, Hasta: fecha_fin }),
            columnas, filas, landscape: true,
            tabla: 'entrega_estudiante',
            descripcion: `Reporte de Entregas (PDF). Filtros: ${JSON.stringify({ fecha_inicio, fecha_fin, id_supervisor })}. Total: ${filas.length}.`,
        });
    } catch (error) {
        await bitacoraSistema(req, `Error en Reporte de Entregas: ${error.message}`);
        if (!res.headersSent) res.status(500).json({ message: MENSAJE_ERROR });
    }
};

// ── 6. Reporte General (solo PDF) ───────────────────────────────────────────────

const reporteGeneral = async (req, res) => {
    const { id_gestion } = req.query;
    try {
        const gestFilter = id_gestion ? 'WHERE c.id_gestion = $1' : '';
        const gestParams = id_gestion ? [id_gestion] : [];

        const [estudiantes, porNivel, deudas, inventario, entregas, docentes] = await Promise.all([
            pool.query(`SELECT COUNT(*) FILTER (WHERE estado='activo') AS activos, COUNT(*) AS total FROM estudiante`),
            pool.query(`
                SELECT n.nombre_nivel, COUNT(DISTINCT i.id_estudiante) AS total
                FROM inscripcion i
                JOIN curso c ON c.id_curso = i.id_curso
                JOIN grado g ON g.id_grado = c.id_grado
                JOIN nivel n ON n.id_nivel = g.id_nivel
                ${gestFilter ? gestFilter + " AND i.estado='inscrito'" : "WHERE i.estado='inscrito'"}
                GROUP BY n.nombre_nivel ORDER BY n.nombre_nivel
            `, gestParams),
            pool.query(`
                SELECT COALESCE(SUM(monto),0) AS total_deuda,
                       COALESCE(SUM(monto) FILTER (WHERE estado='pendiente' OR estado='mora'),0) AS pendiente
                FROM deuda d ${id_gestion ? 'WHERE d.id_gestion = $1' : ''}
            `, gestParams),
            pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE stock_actual <= stock_minimo) AS bajos FROM material`),
            pool.query(`SELECT COUNT(*) AS total FROM entrega_estudiante`),
            pool.query(`SELECT COUNT(*) AS total FROM profesor WHERE estado = true`),
        ]);

        const est = estudiantes.rows[0];
        const deu = deudas.rows[0];
        const inv = inventario.rows[0];

        const stats = [
            ['Estudiantes activos', est.activos],
            ['Estudiantes (total)', est.total],
            ['Plantel docente', docentes.rows[0].total],
            ['Entregas registradas', entregas.rows[0].total],
            ['Deuda total emitida', `Bs ${parseFloat(deu.total_deuda).toFixed(2)}`],
            ['Saldo pendiente', `Bs ${parseFloat(deu.pendiente).toFixed(2)}`],
            ['Materiales en inventario', inv.total],
            ['Materiales con stock bajo', inv.bajos],
        ];

        const filasNivel = porNivel.rows.map((r) => ({ nombre_nivel: r.nombre_nivel, total: r.total }));

        const secciones = [
            { tipo: 'stats', titulo: 'Estadísticas Globales', items: stats },
        ];
        if (filasNivel.length > 0) {
            secciones.push({
                tipo: 'tabla', titulo: 'Estudiantes Inscritos por Nivel',
                columnas: pdfCols([
                    { header: 'Nivel', key: 'nombre_nivel', w: 0.7 },
                    { header: 'Estudiantes', key: 'total', w: 0.3, align: 'center' },
                ]),
                filas: filasNivel,
            });
        }

        generarReportePdf(res, {
            filename: 'reporte_general.pdf',
            titulo: 'Reporte General del Colegio',
            subtitulo: 'Resumen ejecutivo',
            filtros: filtrosLegibles(req, {}),
            secciones,
        });
        await bitacoraExportacion(req, {
            tabla: 'estudiante',
            descripcion: `Reporte General (PDF). Filtros: ${JSON.stringify({ id_gestion })}.`,
        });
    } catch (error) {
        await bitacoraSistema(req, `Error en Reporte General: ${error.message}`);
        if (!res.headersSent) res.status(500).json({ message: MENSAJE_ERROR });
    }
};

// ── Datos para los filtros del panel ────────────────────────────────────────────

const obtenerFiltros = async (req, res) => {
    try {
        const [gestiones, niveles, cursos, materias, categorias, supervisores] = await Promise.all([
            pool.query('SELECT id_gestion, anio, estado FROM gestion_academica ORDER BY anio DESC'),
            pool.query('SELECT id_nivel, nombre_nivel FROM nivel ORDER BY id_nivel'),
            pool.query(`
                SELECT c.id_curso, c.id_gestion, g.id_nivel,
                       n.nombre_nivel || ' - ' || g.nombre_grado || ' "' || c.paralelo || '" (' || c.turno || ')' AS label
                FROM curso c
                JOIN grado g ON g.id_grado = c.id_grado
                JOIN nivel n ON n.id_nivel = g.id_nivel
                WHERE c.estado = true
                ORDER BY n.nombre_nivel, g.nombre_grado, c.paralelo
            `),
            pool.query('SELECT id_materia, nombre_materia FROM materia WHERE estado = true ORDER BY nombre_materia'),
            pool.query("SELECT DISTINCT categoria FROM material ORDER BY categoria"),
            pool.query(`
                SELECT DISTINCT u.id_usuario,
                       COALESCE(p.nombre || ' ' || p.apellido, u.username) AS label
                FROM entrega_estudiante ee
                JOIN usuario u ON u.id_usuario = ee.id_usuario_supervisor
                LEFT JOIN profesor p ON p.id_usuario = ee.id_usuario_supervisor
                ORDER BY label
            `),
        ]);

        res.json({
            gestiones: gestiones.rows,
            niveles: niveles.rows,
            cursos: cursos.rows,
            materias: materias.rows,
            categorias: categorias.rows.map((r) => r.categoria),
            dimensiones: ['Ser', 'Saber', 'Hacer', 'Autoevaluacion'],
            supervisores: supervisores.rows,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al cargar filtros', error: error.message });
    }
};

// ── Reportes recientes (bitácora EXPORTACION) ───────────────────────────────────

const reportesRecientes = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT b.descripcion, b.tabla_afectada, b.fecha_hora,
                   COALESCE(u.username, 'Sistema') AS usuario
            FROM bitacora b
            LEFT JOIN usuario u ON u.id_usuario = b.id_usuario
            WHERE b.accion = 'EXPORTACION'
            ORDER BY b.fecha_hora DESC
            LIMIT 10
        `);
        res.json({ recientes: rows });
    } catch (error) {
        res.status(500).json({ message: 'Error al cargar reportes recientes', error: error.message });
    }
};

// Construye un mapa de filtros legibles para el banner (omite gestión, va en subtítulo)
function filtrosLegibles(req, extra) {
    const base = {};
    Object.entries(extra || {}).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') base[k] = v;
    });
    return base;
}

module.exports = {
    reporteEstudiantes,
    reportePagos,
    reporteInventario,
    reporteCalificaciones,
    reporteEntregas,
    reporteGeneral,
    obtenerFiltros,
    reportesRecientes,
};

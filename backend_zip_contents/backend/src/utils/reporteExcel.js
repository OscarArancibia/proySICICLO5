const ExcelJS = require('exceljs');

const HEADER_FILL = 'FF1A56A4';
const SUBTITLE_COLOR = 'FF6B7280';

/**
 * Construye y transmite un archivo Excel (.xlsx) al response.
 * @param {object} res Express response
 * @param {object} cfg
 *   - filename: string
 *   - titulo: string
 *   - subtitulo?: string
 *   - filtros?: Record<string,string>
 *   - hojas: Array<{ nombre, columnas: [{header, key, width?}], filas: object[] }>
 */
async function generarReporteExcel(res, cfg) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema de Gestión Educativa - U.E. Fausto Medrano Sandoval "A"';
    wb.created = new Date();

    (cfg.hojas || []).forEach((hoja) => {
        const ws = wb.addWorksheet(hoja.nombre.substring(0, 31));
        const numCols = hoja.columnas.length;
        const lastColLetter = ws.getColumn(numCols).letter;

        // Título institucional
        ws.mergeCells(`A1:${lastColLetter}1`);
        const tCell = ws.getCell('A1');
        tCell.value = cfg.titulo;
        tCell.font = { bold: true, size: 14, color: { argb: HEADER_FILL } };
        tCell.alignment = { horizontal: 'center' };

        // Subtítulo / filtros
        ws.mergeCells(`A2:${lastColLetter}2`);
        const sCell = ws.getCell('A2');
        const filtrosTxt = Object.entries(cfg.filtros || {})
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `${k}: ${v}`)
            .join('   |   ');
        sCell.value = [cfg.subtitulo, filtrosTxt, `Emitido: ${new Date().toLocaleString('es-BO')}`]
            .filter(Boolean).join('   |   ');
        sCell.font = { size: 9, color: { argb: SUBTITLE_COLOR } };
        sCell.alignment = { horizontal: 'center' };

        // Fila de encabezados (fila 4)
        const headerRowIdx = 4;
        const headerRow = ws.getRow(headerRowIdx);
        hoja.columnas.forEach((col, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = col.header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' },
            };
            ws.getColumn(i + 1).width = col.width || 20;
        });
        headerRow.commit();

        // Datos
        hoja.filas.forEach((fila, idx) => {
            const row = ws.getRow(headerRowIdx + 1 + idx);
            hoja.columnas.forEach((col, i) => {
                const cell = row.getCell(i + 1);
                const val = fila[col.key];
                cell.value = val === null || val === undefined ? '' : val;
                cell.alignment = { vertical: 'middle' };
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6FC' } };
                }
            });
            row.commit();
        });

        ws.autoFilter = {
            from: { row: headerRowIdx, column: 1 },
            to: { row: headerRowIdx, column: numCols },
        };
        ws.views = [{ state: 'frozen', ySplit: headerRowIdx }];
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${cfg.filename}`);
    await wb.xlsx.write(res);
    res.end();
}

module.exports = { generarReporteExcel };

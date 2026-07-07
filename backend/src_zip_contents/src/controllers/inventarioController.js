const pool = require('../config/db');
const { registrarBitacora, getClientIp } = require('../utils/bitacora');

const getMateriales = async (req, res) => {
    const { search, categoria, estado = 'true' } = req.query;

    try {
        const conditions = [];
        const params = [];
        let idx = 1;

        if (estado !== 'todos') {
            conditions.push(`m.estado = $${idx++}`);
            params.push(estado === 'true');
        }
        if (search) {
            conditions.push(`(m.nombre_item ILIKE $${idx} OR m.descripcion ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }
        if (categoria) {
            conditions.push(`m.categoria = $${idx++}`);
            params.push(categoria);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await pool.query(`
            SELECT
                m.id_material,
                m.nombre_item,
                m.descripcion,
                m.categoria,
                m.stock_actual,
                m.stock_minimo,
                m.estado,
                m.fecha_registro,
                ult.fecha_movimiento AS ultima_fecha_movimiento,
                ult.tipo_movimiento AS ultimo_tipo_movimiento
            FROM material m
            LEFT JOIN LATERAL (
                SELECT mi.fecha_movimiento, mi.tipo_movimiento
                FROM movimiento_inventario mi
                WHERE mi.id_material = m.id_material
                ORDER BY mi.fecha_movimiento DESC
                LIMIT 1
            ) ult ON TRUE
            ${where}
            ORDER BY m.nombre_item
        `, params);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener materiales', error: error.message });
    }
};

const getMovimientos = async (req, res) => {
    const { id_material, limit = 100 } = req.query;

    try {
        const params = [];
        let where = '';
        if (id_material) {
            params.push(id_material);
            where = 'WHERE mi.id_material = $1';
        }

        params.push(Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500));
        const limitParam = params.length;

        const result = await pool.query(`
            SELECT
                mi.id_movimiento,
                mi.id_material,
                m.nombre_item,
                mi.tipo_movimiento,
                mi.cantidad,
                mi.fecha_movimiento,
                mi.observaciones,
                u.username AS usuario
            FROM movimiento_inventario mi
            JOIN material m ON m.id_material = mi.id_material
            JOIN usuario u ON u.id_usuario = mi.id_usuario
            ${where}
            ORDER BY mi.fecha_movimiento DESC
            LIMIT $${limitParam}
        `, params);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener movimientos', error: error.message });
    }
};

const createMaterial = async (req, res) => {
    const { nombre_item, descripcion, categoria, stock_minimo = 0, stock_inicial = 0 } = req.body;

    if (!nombre_item || !categoria) {
        return res.status(400).json({ message: 'Nombre y categoria son obligatorios' });
    }

    if (Number(stock_minimo) < 0 || Number(stock_inicial) < 0) {
        return res.status(400).json({ message: 'El stock mínimo y el stock inicial no pueden ser negativos' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // E2. Material duplicado (Verificar si existe otro material activo con el mismo nombre y categoría)
        const duplicateCheck = await client.query(
            'SELECT id_material FROM material WHERE LOWER(nombre_item) = LOWER($1) AND LOWER(categoria) = LOWER($2) AND estado = true',
            [nombre_item.trim(), categoria.trim()]
        );

        if (duplicateCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'El material ya se encuentra registrado y activo.' });
        }

        const material = await client.query(`
            INSERT INTO material (nombre_item, descripcion, categoria, stock_actual, stock_minimo)
            VALUES ($1, $2, $3, 0, $4)
            RETURNING *
        `, [nombre_item.trim(), descripcion || null, categoria.trim(), Number(stock_minimo) || 0]);

        if (Number(stock_inicial) > 0) {
            await client.query(`
                INSERT INTO movimiento_inventario (id_material, tipo_movimiento, cantidad, id_usuario, observaciones)
                VALUES ($1, 'entrada', $2, $3, $4)
            `, [material.rows[0].id_material, Number(stock_inicial), req.usuario.id, 'Stock inicial']);
        }

        await client.query('COMMIT');

        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'inventario',
            nombre_permiso: 'gestionar_inventario',
            metodo: 'POST /api/inventario/materiales',
            accion: 'INSERT',
            tabla_afectada: 'material',
            id_registro_afectado: material.rows[0].id_material,
            descripcion: `Creación de material: ${nombre_item}`,
            ip_origen: getClientIp(req)
        });

        res.status(201).json({ message: 'Material creado correctamente', material: material.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error al crear material', error: error.message });
    } finally {
        client.release();
    }
};

const updateMaterial = async (req, res) => {
    const { id } = req.params;
    const { nombre_item, descripcion, categoria, stock_minimo, estado } = req.body;

    try {
        // E2. Material duplicado: si se cambia nombre o categoría, verificar que no colisione con otro material activo
        if (nombre_item || categoria) {
            const currentRes = await pool.query('SELECT nombre_item, categoria FROM material WHERE id_material = $1', [id]);
            if (currentRes.rows.length === 0) {
                return res.status(404).json({ message: 'Material no encontrado' });
            }
            const currentName = currentRes.rows[0].nombre_item;
            const currentCat = currentRes.rows[0].categoria;

            const targetName = nombre_item !== undefined ? nombre_item.trim() : currentName;
            const targetCat = categoria !== undefined ? categoria.trim() : currentCat;

            const duplicateCheck = await pool.query(
                'SELECT id_material FROM material WHERE LOWER(nombre_item) = LOWER($1) AND LOWER(categoria) = LOWER($2) AND estado = true AND id_material <> $3',
                [targetName, targetCat, id]
            );

            if (duplicateCheck.rows.length > 0) {
                return res.status(409).json({ message: 'Ya existe otro material registrado y activo con el mismo nombre y categoría.' });
            }
        }

        if (stock_minimo !== undefined && Number(stock_minimo) < 0) {
            return res.status(400).json({ message: 'El stock mínimo no puede ser negativo' });
        }

        const result = await pool.query(`
            UPDATE material
            SET nombre_item = COALESCE($1, nombre_item),
                descripcion = COALESCE($2, descripcion),
                categoria = COALESCE($3, categoria),
                stock_minimo = COALESCE($4, stock_minimo),
                estado = COALESCE($5, estado)
            WHERE id_material = $6
            RETURNING *
        `, [
            nombre_item ? nombre_item.trim() : null,
            descripcion ?? null,
            categoria ? categoria.trim() : null,
            stock_minimo === undefined ? null : Number(stock_minimo),
            estado === undefined ? null : Boolean(estado),
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Material no encontrado' });
        }

        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'inventario',
            nombre_permiso: 'gestionar_inventario',
            metodo: 'PUT /api/inventario/materiales/:id',
            accion: 'UPDATE',
            tabla_afectada: 'material',
            id_registro_afectado: result.rows[0].id_material,
            descripcion: estado !== undefined ? 
                (estado ? `Activación de material: ${result.rows[0].nombre_item}` : `Desactivación de material: ${result.rows[0].nombre_item}`) : 
                `Modificación de material: ${result.rows[0].nombre_item}`,
            ip_origen: getClientIp(req)
        });

        res.json({ message: 'Material actualizado correctamente', material: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar material', error: error.message });
    }
};

const registrarMovimiento = async (req, res) => {
    const { id_material, tipo_movimiento, cantidad, observaciones } = req.body;

    if (!id_material || !['entrada', 'salida'].includes(tipo_movimiento) || !Number(cantidad) || Number(cantidad) <= 0) {
        return res.status(400).json({ message: 'Material, tipo y cantidad válida (mayor a 0) son obligatorios.' });
    }

    try {
        // E4. Material inactivo: verificar si el material está activo
        const materialCheck = await pool.query(
            'SELECT estado, nombre_item FROM material WHERE id_material = $1',
            [id_material]
        );

        if (materialCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Material no encontrado.' });
        }

        if (!materialCheck.rows[0].estado) {
            return res.status(400).json({ message: 'Operación no permitida: El material está inactivo.' });
        }

        const result = await pool.query(`
            INSERT INTO movimiento_inventario (id_material, tipo_movimiento, cantidad, id_usuario, observaciones)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [id_material, tipo_movimiento, Number(cantidad), req.usuario.id, observaciones || null]);

        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'inventario',
            nombre_permiso: 'gestionar_inventario',
            metodo: 'POST /api/inventario/movimientos',
            accion: 'INSERT',
            tabla_afectada: 'movimiento_inventario',
            id_registro_afectado: result.rows[0].id_movimiento,
            descripcion: `Registro de movimiento (${tipo_movimiento}) de ${cantidad} unidad(es) de ${materialCheck.rows[0].nombre_item}`,
            ip_origen: getClientIp(req)
        });

        res.status(201).json({ message: 'Movimiento registrado correctamente', movimiento: result.rows[0] });
    } catch (error) {
        const status = error.message.includes('Stock insuficiente') ? 409 : 500;
        res.status(status).json({ message: 'Error al registrar movimiento', error: error.message });
    }
};

module.exports = { getMateriales, getMovimientos, createMaterial, updateMaterial, registrarMovimiento };

const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { validatePasswordStrength } = require('../utils/passwordPolicy');

const createUser = async (req, res) => {
    const { username, password, id_rol, estado, email } = req.body;

    if (!username || !password || !id_rol || !email) {
        return res.status(400).json({ message: 'Todos los campos obligatorios (username, email, password e id_rol) deben estar llenos.' });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
        return res.status(400).json({ message: passwordValidation.message });
    }

    try {
        const usuarioExistente = await pool.query('SELECT id_usuario FROM usuario WHERE username = $1 OR email = $2',
            [username, email]
        );
        if (usuarioExistente.rows.length > 0) {
            return res.status(409).json({ message: 'El nombre de usuario o el correo electrónico ya está en uso.' });
        }

        const rolExistente = await pool.query('SELECT id_rol FROM rol WHERE id_rol = $1', [id_rol]);
        if (rolExistente.rows.length === 0) {
            return res.status(400).json({ message: 'El rol especificado no existe en el sistema.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const estadoFinal = estado !== undefined ? estado : true;

        const newUser = await pool.query(
            'INSERT INTO usuario (username, password_hash, id_rol, estado , email) VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario, username, id_rol, estado, email',
            [username, password_hash, id_rol, estadoFinal, email]
        );

        res.status(201).json({
            message: 'Usuario creado con éxito.',
            user: newUser.rows[0]
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear el usuario.', error: error.message });
    }
}

const getUsers = async (req, res) => {
    try {
        const usuario = await pool.query(`
            SELECT u.id_usuario, u.username, u.email, u.estado, u.ultimo_acceso, u.fecha_creacion, r.nombre_rol, r.id_rol
            FROM usuario u
            JOIN rol r ON u.id_rol = r.id_rol
            ORDER BY u.id_usuario ASC
            `);
        res.json(usuario.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuarios.', error: error.message });
    }
}

const updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, id_rol, estado, email } = req.body;

    if (!username || !id_rol || estado === undefined || !email) {
        return res.status(400).json({ message: 'Debe enviar username, email, id_rol y estado para actualizar el usuario.' });
    }

    try {

        const usuarioExistente = await pool.query('SELECT id_usuario FROM usuario WHERE (username = $1 OR email = $2) AND id_usuario != $3', [username, email, id]);
        if (usuarioExistente.rows.length > 0) {
            return res.status(400).json({ message: 'El nombre de usuario o correo electrónico ya está en uso por otra cuenta.' });
        }

        const updatedUser = await pool.query(
            'UPDATE usuario SET username = $1, email = $2, id_rol = $3, estado = $4 WHERE id_usuario = $5 RETURNING id_usuario, email, username, id_rol, estado',
            [username, email, id_rol, estado, id]
        );

        if (updatedUser.rows.length == 0) return res.status(404).json({ message: 'Usuario no encontrado.' });

        res.json({ message: 'El usuario se actualizó correctamente.', user: updatedUser.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el usuario.', error: error.message });
    }
}

const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const desactivedUser = await pool.query(
            'UPDATE usuario SET estado = false WHERE id_usuario = $1 RETURNING id_usuario, username, estado',
            [id]);

        if (desactivedUser.rows.length == 0) return res.status(404).json({ message: 'Usuario no encontrado.' });

        res.json({ message: 'Usuario desactivado correctamente.', user: desactivedUser.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al desactivar el usuario.', error: error.message });
    }
}

module.exports = { createUser, getUsers, updateUser, deleteUser };

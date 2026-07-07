const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó un token.' });
    }

    try {

        const decodificado = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decodificado;
        next();

    } catch (error) {
        return res.status(403).json({ message: 'El token es inválido o ha expirado.' });
    }
};

const esSuperUsuario = (req, res, next) => {
    if (!req.usuario || req.usuario.role !== 1) {
        return res.status(403).json({ message: 'Operación rechazada. No tiene los permisos necesarios.' });
    }
    next();
}

const esAdminODirector = (req, res, next) => {
    if (!req.usuario || (req.usuario.role !== 1 && req.usuario.role !== 2)) {
        return res.status(403).json({ message: 'Operación rechazada. No tiene los permisos de gestión necesarios.' });
    }
    next();
};

const esAdminDirectorOSecretaria = (req, res, next) => {
    if (!req.usuario || ![1, 2, 4].includes(req.usuario.role)) {
        return res.status(403).json({ message: 'Operación rechazada. No tiene los permisos de gestión necesarios.' });
    }
    next();
};

const esEstudiante = (req, res, next) => {
    if (!req.usuario || req.usuario.nombre_rol !== 'Estudiante') {
        return res.status(403).json({ message: 'Acceso exclusivo para el portal estudiantil.' });
    }
    if (!req.usuario.id_estudiante) {
        return res.status(403).json({ message: 'Cuenta no vinculada a un estudiante. Contacta al administrador.' });
    }
    next();
};

module.exports = { verificarToken, esSuperUsuario, esAdminODirector, esAdminDirectorOSecretaria, esEstudiante };

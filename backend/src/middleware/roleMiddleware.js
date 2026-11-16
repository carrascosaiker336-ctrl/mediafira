const { sendJson } = require("../utils/response");

function roleMiddleware(...rolesPermitidos) {
    if (rolesPermitidos.length === 0) {
        throw new Error("roleMiddleware requiere al menos un rol permitido.");
    }

    return function verificarRol(req, res) {
        if (!req.auth) {
            sendJson(res, 401, { mensaje: "Autenticación requerida." });
            return false;
        }

        if (!rolesPermitidos.includes(req.auth.rol)) {
            sendJson(res, 403, { mensaje: "No tienes permisos para esta acción." });
            return false;
        }

        return true;
    };
}

module.exports = roleMiddleware;
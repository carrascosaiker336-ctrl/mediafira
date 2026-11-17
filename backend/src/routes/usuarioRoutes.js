const { crearUsuario, loginUsuario } = require(
    "../controllers/usuarioController"
);

// Ruta pública para autenticación y registro de usuarios.
async function usuarioRoutes(req, res) {
    // POST /api/usuarios: registro del usuario con validación de datos y documento.
    if (req.pathname === "/api/usuarios" && req.method === "POST") {
        return crearUsuario(req, res);
    }

    // POST /api/login: inicio de sesión con comprobación de credenciales y token JWT.
    if (req.pathname === "/api/login" && req.method === "POST") {
        return loginUsuario(req, res);
    }

    return false;
}

module.exports = usuarioRoutes;
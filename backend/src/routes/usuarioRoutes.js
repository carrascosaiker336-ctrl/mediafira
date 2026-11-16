const { crearUsuario, loginUsuario } = require(
    "../controllers/usuarioController"
);

async function usuarioRoutes(req, res) {
    if (req.pathname === "/api/usuarios" && req.method === "POST") {
        return crearUsuario(req, res);
    }

    if (req.pathname === "/api/login" && req.method === "POST") {
        return loginUsuario(req, res);
    }

    return false;
}

module.exports = usuarioRoutes;
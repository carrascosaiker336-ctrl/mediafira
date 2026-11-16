const jwt = require("jsonwebtoken");
const { sendJson } = require("../utils/response");

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error("JWT_SECRET debe tener al menos 32 caracteres.");
    }

    return secret;
}

function crearTokenAcceso(usuario) {
    return jwt.sign(
        { rol: usuario.rol },
        getJwtSecret(),
        {
            subject: usuario._id.toString(),
            expiresIn: "8h",
            issuer: "mediaferia"
        }
    );
}

function authMiddleware(req, res) {
    const authorization = req.headers.authorization;
    const match = typeof authorization === "string"
        ? authorization.match(/^Bearer\s+(\S+)$/i)
        : null;

    if (!match) {
        sendJson(res, 401, { mensaje: "Autenticación requerida." });
        return false;
    }

    try {
        const payload = jwt.verify(match[1], getJwtSecret(), {
            issuer: "mediaferia"
        });

        if (
            typeof payload === "string" ||
            typeof payload.sub !== "string" ||
            typeof payload.rol !== "string"
        ) {
            sendJson(res, 401, { mensaje: "Token no válido." });
            return false;
        }

        req.auth = {
            id: payload.sub,
            rol: payload.rol
        };
        return true;
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            sendJson(res, 401, { mensaje: "Token no válido o caducado." });
            return false;
        }

        throw error;
    }
}

module.exports = { authMiddleware, crearTokenAcceso };
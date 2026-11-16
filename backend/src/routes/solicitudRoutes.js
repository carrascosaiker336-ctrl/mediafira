const parseJson = require("../middleware/jsonParser");
const {
    listarMisSolicitudes,
    listarSolicitudesDeFerias,
    crearSolicitud,
    actualizarEstado
} = require("../controllers/solicitudController");
const { sendJson } = require("../utils/response");

async function solicitudRoutes(req, res) {
    if (req.pathname === "/api/solicitudes/mias") {
        if (req.method !== "GET") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        await listarMisSolicitudes(req, res);
        return true;
    }

    if (req.pathname === "/api/solicitudes") {
        if (req.method === "GET") {
            await listarSolicitudesDeFerias(req, res);
            return true;
        }
        if (req.method === "POST") {
            req.body = await parseJson(req);
            await crearSolicitud(req, res);
            return true;
        }
        sendJson(res, 405, { mensaje: "Método no permitido." });
        return true;
    }

    if (/^\/api\/solicitudes\/[a-f\d]{24}\/estado$/i.test(req.pathname)) {
        if (req.method !== "PATCH") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        req.body = await parseJson(req);
        await actualizarEstado(req, res);
        return true;
    }

    return false;
}

module.exports = solicitudRoutes;
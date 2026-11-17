const parseJson = require("../middleware/jsonParser");
const {
    listarMisSolicitudes,
    listarSolicitudesDeFerias,
    crearSolicitud,
    actualizarEstado
} = require("../controllers/solicitudController");
const { sendJson } = require("../utils/response");

// Este router centraliza las rutas de solicitudes y delega cada caso al controller adecuado.
async function solicitudRoutes(req, res) {
    // GET /api/solicitudes/mias: devuelve las solicitudes del feriante autenticado.
    if (req.pathname === "/api/solicitudes/mias") {
        if (req.method !== "GET") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        await listarMisSolicitudes(req, res);
        return true;
    }

    // GET /api/solicitudes: lista solicitudes del organizador; POST crea una solicitud nueva.
    if (req.pathname === "/api/solicitudes") {
        if (req.method === "GET") {
            await listarSolicitudesDeFerias(req, res);
            return true;
        }
        if (req.method === "POST") {
            // El cuerpo JSON se parsea antes de crear la solicitud porque incluye feria y espacio.
            req.body = await parseJson(req);
            await crearSolicitud(req, res);
            return true;
        }
        sendJson(res, 405, { mensaje: "Método no permitido." });
        return true;
    }

    // PATCH /api/solicitudes/:id/estado: aprueba o rechaza una solicitud de un feriante.
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
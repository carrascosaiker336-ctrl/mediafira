const parseJson = require("../middleware/jsonParser");
const {
    listarAyuntamientos,
    listarFerias,
    crearFeria,
    actualizarAprobacion
} = require("../controllers/feriaController");
const { sendJson } = require("../utils/response");

async function feriaRoutes(req, res) {
    if (req.pathname === "/api/ferias/ayuntamientos") {
        if (req.method !== "GET") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        await listarAyuntamientos(req, res);
        return true;
    }

    if (req.pathname === "/api/ferias") {
        if (req.method === "GET") {
            await listarFerias(req, res);
            return true;
        }
        if (req.method === "POST") {
            req.body = await parseJson(req);
            await crearFeria(req, res);
            return true;
        }
        sendJson(res, 405, { mensaje: "Método no permitido." });
        return true;
    }

    if (/^\/api\/ferias\/[a-f\d]{24}\/aprobacion$/i.test(req.pathname)) {
        if (req.method !== "PATCH") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        req.body = await parseJson(req);
        await actualizarAprobacion(req, res);
        return true;
    }

    return false;
}

module.exports = feriaRoutes;
const parseJson = require("../middleware/jsonParser");
const {
    listarSolicitudes,
    crearCheckout,
    crearCheckoutPrueba,
    verificarCheckout,
    procesarWebhook
} = require("../controllers/pagoController");
const { sendJson } = require("../utils/response");

async function pagoRoutes(req, res) {
    if (req.pathname === "/api/pagos/webhook") {
        if (req.method !== "POST") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        await procesarWebhook(req, res);
        return true;
    }

    if (req.pathname === "/api/pagos/solicitudes") {
        if (req.method !== "GET") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        await listarSolicitudes(req, res);
        return true;
    }

    if (req.pathname === "/api/pagos/checkout") {
        if (req.method !== "POST") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        req.body = await parseJson(req);
        await crearCheckout(req, res);
        return true;
    }

    if (req.pathname === "/api/pagos/checkout-prueba") {
        if (req.method !== "POST") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        req.body = await parseJson(req);
        await crearCheckoutPrueba(req, res);
        return true;
    }

    if (req.pathname === "/api/pagos/verificar") {
        if (req.method !== "GET") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        await verificarCheckout(req, res);
        return true;
    }

    return false;
}

module.exports = pagoRoutes;

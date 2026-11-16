const parseJson = require("../middleware/jsonParser");
const {
    listarContactos,
    listarConversaciones,
    crearConversacion,
    listarMensajes,
    enviarMensaje
} = require("../controllers/chatController");
const { sendJson } = require("../utils/response");

async function chatRoutes(req, res) {
    if (req.pathname === "/api/chat/contactos") {
        if (req.method !== "GET") {
            sendJson(res, 405, { mensaje: "Método no permitido." });
            return true;
        }

        await listarContactos(req, res);
        return true;
    }

    if (req.pathname === "/api/chat/conversaciones") {
        if (req.method === "GET") {
            await listarConversaciones(req, res);
            return true;
        }
        if (req.method === "POST") {
            req.body = await parseJson(req);
            await crearConversacion(req, res);
            return true;
        }
        sendJson(res, 405, { mensaje: "Método no permitido." });
        return true;
    }

    if (/^\/api\/chat\/conversaciones\/[a-f\d]{24}\/mensajes$/i.test(req.pathname)) {
        if (req.method === "GET") {
            await listarMensajes(req, res);
            return true;
        }
        if (req.method === "POST") {
            req.body = await parseJson(req);
            await enviarMensaje(req, res);
            return true;
        }
        sendJson(res, 405, { mensaje: "Método no permitido." });
        return true;
    }

    return false;
}

module.exports = chatRoutes;

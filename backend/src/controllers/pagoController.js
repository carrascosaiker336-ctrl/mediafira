const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const Pago = require("../models/Pago");
const Solicitud = require("../models/Solicitud");
const roleMiddleware = require("../middleware/roleMiddleware");
const { sendJson } = require("../utils/response");
const { getAppUrl, getStripeClient } = require("../services/stripeService");

const verificarFeriante = roleMiddleware("feriante");
const IMPORTE_PRUEBA_CENTIMOS = 3000;

function errorHttp(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function importeEnCentimos(importe) {
    return Math.round(importe * 100);
}

function sesionCoincideConPago(pago, sesion) {
    const metadata = sesion.metadata || {};

    return (
        sesion.payment_status === "paid" &&
        sesion.currency === "eur" &&
        sesion.amount_total === importeEnCentimos(pago.importe) &&
        sesion.client_reference_id === pago._id.toString() &&
        metadata.pagoId === pago._id.toString() &&
        metadata.solicitudId === pago.solicitud.toString() &&
        metadata.ferianteId === pago.usuario.toString()
    );
}

async function marcarPagoComoPagado(pago, sesion) {
    if (!sesionCoincideConPago(pago, sesion)) {
        return false;
    }

    pago.estado = "pagado";
    if (typeof sesion.payment_intent === "string") {
        pago.stripePaymentIntentId = sesion.payment_intent;
    } else if (sesion.payment_intent && sesion.payment_intent.id) {
        pago.stripePaymentIntentId = sesion.payment_intent.id;
    }
    await pago.save();
    return true;
}

async function listarSolicitudes(req, res) {
    if (!verificarFeriante(req, res)) {
        return;
    }

    const solicitudes = await Solicitud.find({
        feriante: req.auth.id,
        estado: "aprobada"
    })
        .populate({ path: "feria", select: "nombre" })
        .populate({ path: "espacio", select: "nombre numero precio" })
        .lean();
    const idsSolicitud = solicitudes.map((solicitud) => solicitud._id);
    const pagos = idsSolicitud.length
        ? await Pago.find({
            usuario: req.auth.id,
            solicitud: { $in: idsSolicitud }
        })
            .sort({ createdAt: -1 })
            .select("solicitud estado")
            .lean()
        : [];
    const estadosPago = new Map();

    for (const pago of pagos) {
        const solicitudId = pago.solicitud.toString();
        const estadoActual = estadosPago.get(solicitudId);

        if (pago.estado === "pagado" || !estadoActual) {
            estadosPago.set(solicitudId, pago.estado);
        }
    }

    const items = solicitudes.map((solicitud) => {
        const espacio = solicitud.espacio;
        const feria = solicitud.feria;
        const importe = espacio && Number.isFinite(Number(espacio.precio))
            ? Number(espacio.precio)
            : null;
        const importeValido = importe !== null &&
            importeEnCentimos(importe) >= 50;
        const estadoPago = estadosPago.get(solicitud._id.toString()) || "pendiente";

        return {
            id: solicitud._id.toString(),
            feria: feria ? feria.nombre : "Feria no disponible",
            espacio: espacio ? espacio.nombre : "Espacio no disponible",
            importe,
            estadoPago,
            puedePagar: estadoPago !== "pagado" &&
                Boolean(feria && espacio && importeValido)
        };
    });

    sendJson(res, 200, { solicitudes: items });
}

async function obtenerSolicitudPagable(req) {
    const solicitudId = req.body && req.body.solicitudId;

    if (
        typeof solicitudId !== "string" ||
        !mongoose.Types.ObjectId.isValid(solicitudId)
    ) {
        throw errorHttp("Indica una solicitud válida.", 400);
    }

    const solicitud = await Solicitud.findOne({
        _id: solicitudId,
        feriante: req.auth.id,
        estado: "aprobada"
    })
        .populate({ path: "feria", select: "nombre" })
        .populate({ path: "espacio", select: "nombre precio" });

    if (!solicitud) {
        throw errorHttp(
            "No se encontró una solicitud aprobada de tu cuenta.",
            404
        );
    }

    if (!solicitud.feria || !solicitud.espacio) {
        throw errorHttp(
            "La solicitud no tiene una feria y un espacio válidos.",
            409
        );
    }

    const importe = Number(solicitud.espacio.precio);
    const centimos = importeEnCentimos(importe);

    if (!Number.isFinite(importe) || centimos < 50) {
        throw errorHttp(
            "El importe del espacio debe ser de al menos 0,50 €.",
            422
        );
    }

    return { solicitud, importe, centimos };
}

async function crearCheckout(req, res) {
    if (!verificarFeriante(req, res)) {
        return;
    }

    const { solicitud, importe, centimos } = await obtenerSolicitudPagable(req);
    const pagoPagado = await Pago.findOne({
        solicitud: solicitud._id,
        usuario: req.auth.id,
        estado: "pagado"
    });

    if (pagoPagado) {
        throw errorHttp("Esta solicitud ya está pagada.", 409);
    }

    const stripe = getStripeClient();
    let pago = await Pago.findOne({
        solicitud: solicitud._id,
        usuario: req.auth.id,
        estado: "pendiente"
    }).sort({ createdAt: -1 });

    if (pago && pago.stripeSessionId) {
        const sesionExistente = await stripe.checkout.sessions.retrieve(
            pago.stripeSessionId
        );

        if (sesionExistente.payment_status === "paid") {
            if (await marcarPagoComoPagado(pago, sesionExistente)) {
                throw errorHttp("Esta solicitud ya está pagada.", 409);
            }

            throw errorHttp(
                "La sesión de Stripe no coincide con el importe de la solicitud.",
                409
            );
        }

        if (sesionExistente.status === "open" && sesionExistente.url) {
            sendJson(res, 200, { url: sesionExistente.url });
            return;
        }

        if (sesionExistente.status !== "expired") {
            throw errorHttp(
                "Stripe todavía está procesando el intento de pago anterior.",
                409
            );
        }

        pago.estado = "cancelado";
        await pago.save();
        pago = null;
    }

    if (!pago) {
        pago = new Pago({
            solicitud: solicitud._id,
            usuario: req.auth.id,
            importe,
            metodoPago: "tarjeta",
            estado: "pendiente"
        });
        try {
            await pago.save();
        } catch (error) {
            if (!error || error.code !== 11000) {
                throw error;
            }

            pago = await Pago.findOne({
                solicitud: solicitud._id,
                usuario: req.auth.id,
                estado: "pendiente"
            }).sort({ createdAt: -1 });

            if (!pago) {
                throw error;
            }
        }
    }

    const appUrl = getAppUrl();
    const nombreProducto =
        `${solicitud.feria.nombre} - ${solicitud.espacio.nombre}`.slice(0, 250);
    let sesion;

    try {
        sesion = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{
                price_data: {
                    currency: "eur",
                    product_data: { name: nombreProducto },
                    unit_amount: centimos
                },
                quantity: 1
            }],
            client_reference_id: pago._id.toString(),
            metadata: {
                pagoId: pago._id.toString(),
                solicitudId: solicitud._id.toString(),
                ferianteId: req.auth.id
            },
            success_url:
                `${appUrl}/pages/pagos.html?estado=exito&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/pages/pagos.html?estado=cancelado`
        }, {
            idempotencyKey: `mediaferia-checkout-${pago._id.toString()}`
        });
    } catch (error) {
        pago.estado = "cancelado";
        await pago.save();

        if (
            error &&
            typeof error.type === "string" &&
            error.type.startsWith("Stripe")
        ) {
            console.error(
                "Stripe Checkout no pudo crear la sesión:",
                error.type,
                error.code || ""
            );
            throw errorHttp(
                "Stripe no pudo iniciar el checkout. Comprueba la configuración de test.",
                502
            );
        }

        throw error;
    }

    if (!sesion.url) {
        pago.estado = "cancelado";
        await pago.save();
        throw errorHttp("Stripe no devolvió una URL de checkout.", 502);
    }

    pago.stripeSessionId = sesion.id;
    await pago.save();
    sendJson(res, 201, { url: sesion.url });
}

async function crearCheckoutPrueba(req, res) {
    if (!verificarFeriante(req, res)) {
        return;
    }

    const stripe = getStripeClient();
    const appUrl = getAppUrl();
    const idPrueba = randomUUID();
    let sesion;

    try {
        sesion = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{
                price_data: {
                    currency: "eur",
                    product_data: { name: "Prueba de checkout MediaFeria" },
                    unit_amount: IMPORTE_PRUEBA_CENTIMOS
                },
                quantity: 1
            }],
            client_reference_id: `mediaferia-test:${req.auth.id}:${idPrueba}`,
            metadata: {
                tipo: "mediaferia_test_payment",
                ferianteId: req.auth.id
            },
            success_url:
                `${appUrl}/pages/pagos.html?estado=prueba&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/pages/pagos.html?estado=cancelado`
        }, {
            idempotencyKey: `mediaferia-test-${idPrueba}`
        });
    } catch (error) {
        if (
            error &&
            typeof error.type === "string" &&
            error.type.startsWith("Stripe")
        ) {
            console.error(
                "Stripe no pudo crear el checkout de prueba:",
                error.type,
                error.code || ""
            );
            throw errorHttp(
                "Stripe no pudo iniciar el checkout de prueba.",
                502
            );
        }

        throw error;
    }

    if (!sesion.url) {
        throw errorHttp("Stripe no devolvió una URL de checkout.", 502);
    }

    sendJson(res, 201, { url: sesion.url });
}

async function verificarCheckout(req, res) {
    if (!verificarFeriante(req, res)) {
        return;
    }

    const sessionId = new URL(req.url, "http://localhost")
        .searchParams.get("session_id");

    if (!sessionId || sessionId.length > 255) {
        throw errorHttp("Falta una sesión de Stripe válida.", 400);
    }

    const pago = await Pago.findOne({
        stripeSessionId: sessionId,
        usuario: req.auth.id
    });

    const stripe = getStripeClient();
    const sesion = await stripe.checkout.sessions.retrieve(sessionId);

    if (!pago) {
        const metadata = sesion.metadata || {};
        const referenciaPrueba = `mediaferia-test:${req.auth.id}:`;

        if (
            metadata.tipo !== "mediaferia_test_payment" ||
            metadata.ferianteId !== req.auth.id ||
            typeof sesion.client_reference_id !== "string" ||
            !sesion.client_reference_id.startsWith(referenciaPrueba) ||
            sesion.currency !== "eur" ||
            sesion.amount_total !== IMPORTE_PRUEBA_CENTIMOS
        ) {
            throw errorHttp("No se encontró este pago de prueba en tu cuenta.", 404);
        }

        const estadoPrueba = sesion.payment_status === "paid"
            ? "pagado"
            : sesion.status === "expired"
                ? "cancelado"
                : "pendiente";

        sendJson(res, 200, { estado: estadoPrueba, prueba: true });
        return;
    }

    if (sesion.payment_status === "paid") {
        if (!await marcarPagoComoPagado(pago, sesion)) {
            throw errorHttp(
                "Stripe devolvió un pago que no coincide con esta solicitud.",
                409
            );
        }
    } else if (sesion.status === "expired" && pago.estado === "pendiente") {
        pago.estado = "cancelado";
        await pago.save();
    }

    sendJson(res, 200, { estado: pago.estado, prueba: true });
}

async function leerCuerpoWebhook(req) {
    const chunks = [];
    let totalBytes = 0;

    for await (const chunk of req) {
        totalBytes += chunk.length;

        if (totalBytes > 1024 * 1024) {
            throw errorHttp("El webhook supera el tamaño permitido.", 413);
        }

        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

async function procesarWebhook(req, res) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret || !webhookSecret.startsWith("whsec_")) {
        throw errorHttp(
            "Falta STRIPE_WEBHOOK_SECRET para verificar los eventos de Stripe.",
            503
        );
    }

    const signature = req.headers["stripe-signature"];

    if (typeof signature !== "string") {
        throw errorHttp("Falta la firma del webhook de Stripe.", 400);
    }

    const stripe = getStripeClient();
    const rawBody = await leerCuerpoWebhook(req);
    let evento;

    try {
        evento = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            webhookSecret
        );
    } catch {
        throw errorHttp("La firma del webhook de Stripe no es válida.", 400);
    }

    const tiposDePago = new Set([
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded"
    ]);

    if (tiposDePago.has(evento.type)) {
        const sesion = evento.data.object;
        const pago = await Pago.findOne({ stripeSessionId: sesion.id });

        if (pago && !await marcarPagoComoPagado(pago, sesion)) {
            console.error(
                "El webhook de Stripe no coincide con el pago local:",
                sesion.id
            );
        }
    } else if (evento.type === "checkout.session.expired") {
        const pago = await Pago.findOne({
            stripeSessionId: evento.data.object.id
        });

        if (pago && pago.estado === "pendiente") {
            pago.estado = "cancelado";
            await pago.save();
        }
    }

    sendJson(res, 200, { recibido: true });
}

module.exports = {
    listarSolicitudes,
    crearCheckout,
    crearCheckoutPrueba,
    verificarCheckout,
    procesarWebhook,
    sesionCoincideConPago
};

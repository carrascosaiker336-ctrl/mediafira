const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const Solicitud = require("../src/models/Solicitud");
const {
    listarSolicitudes,
    crearCheckoutPrueba,
    sesionCoincideConPago
} = require("../src/controllers/pagoController");
const { getStripeClient } = require("../src/services/stripeService");

const originalSecretKey = process.env.STRIPE_SECRET_KEY;
const originalStripeApiKey = process.env.StripeApiKey;
const originalFind = Solicitud.find;

afterEach(() => {
    if (originalSecretKey === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
    } else {
        process.env.STRIPE_SECRET_KEY = originalSecretKey;
    }

    if (originalStripeApiKey === undefined) {
        delete process.env.StripeApiKey;
    } else {
        process.env.StripeApiKey = originalStripeApiKey;
    }

    Solicitud.find = originalFind;
});

function createResponse() {
    return {
        writeHead(statusCode) {
            this.statusCode = statusCode;
        },
        end(body) {
            this.body = JSON.parse(body);
        }
    };
}

test("Stripe integration rejects live secret keys", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_test-must-not-be-accepted";

    assert.throws(
        () => getStripeClient(),
        (error) => error.statusCode === 503
    );
});

test("Stripe integration accepts a test-mode secret key", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_local-fixture";

    const stripe = getStripeClient();

    assert.equal(typeof stripe.checkout.sessions.create, "function");
});

test("Stripe integration reads the StripeApiKey env variable", () => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.StripeApiKey = "sk_test_local-fixture";

    const stripe = getStripeClient();

    assert.equal(typeof stripe.checkout.sessions.create, "function");
});

test("only feriantes can list requests or start a test checkout", async () => {
    let databaseQueried = false;
    Solicitud.find = () => {
        databaseQueried = true;
        throw new Error("The database must not be queried for another role.");
    };
    const listResponse = createResponse();

    await listarSolicitudes({
        auth: { id: "organizador-id", rol: "organizador" }
    }, listResponse);

    assert.equal(listResponse.statusCode, 403);

    const checkoutResponse = createResponse();
    await crearCheckoutPrueba({
        auth: { id: "organizador-id", rol: "organizador" }
    }, checkoutResponse);

    assert.equal(checkoutResponse.statusCode, 403);
    assert.equal(databaseQueried, false);
});

test("Stripe sessions must match the saved payment amount and owner", () => {
    const pago = {
        _id: { toString: () => "pago-id" },
        solicitud: { toString: () => "solicitud-id" },
        usuario: { toString: () => "feriante-id" },
        importe: 12
    };
    const sesion = {
        payment_status: "paid",
        currency: "eur",
        amount_total: 1200,
        client_reference_id: "pago-id",
        metadata: {
            pagoId: "pago-id",
            solicitudId: "solicitud-id",
            ferianteId: "feriante-id"
        }
    };

    assert.equal(sesionCoincideConPago(pago, sesion), true);
    assert.equal(
        sesionCoincideConPago(pago, { ...sesion, amount_total: 1201 }),
        false
    );
    assert.equal(
        sesionCoincideConPago(pago, {
            ...sesion,
            metadata: { ...sesion.metadata, ferianteId: "otro-feriante" }
        }),
        false
    );
});

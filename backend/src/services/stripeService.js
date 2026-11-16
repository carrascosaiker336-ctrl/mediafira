const Stripe = require("stripe");

function createConfigurationError(message) {
    const error = new Error(message);
    error.statusCode = 503;
    return error;
}

function getStripeClient() {
    const secretKey = process.env.STRIPE_SECRET_KEY ||
        process.env.StripeApiKey;

    if (!secretKey) {
        throw createConfigurationError(
            "Stripe no está configurado. Añade STRIPE_SECRET_KEY o StripeApiKey en backend/.env."
        );
    }

    if (!secretKey.startsWith("sk_test_")) {
        throw createConfigurationError(
            "MediaFeria solo acepta claves secretas de Stripe en modo test."
        );
    }

    return new Stripe(secretKey);
}

function getAppUrl() {
    const configuredUrl = process.env.APP_URL ||
        `http://127.0.0.1:${process.env.PORT || 3000}`;
    let appUrl;

    try {
        appUrl = new URL(configuredUrl);
    } catch {
        const error = new Error("APP_URL no es una URL válida.");
        error.statusCode = 500;
        throw error;
    }

    if (
        !["http:", "https:"].includes(appUrl.protocol) ||
        appUrl.username ||
        appUrl.password
    ) {
        const error = new Error("APP_URL debe usar HTTP o HTTPS y no incluir credenciales.");
        error.statusCode = 500;
        throw error;
    }

    return appUrl.origin;
}

module.exports = { getStripeClient, getAppUrl };

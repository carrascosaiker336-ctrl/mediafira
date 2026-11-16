(async () => {
    let claims;

    try {
        claims = window.mediaferiaSession.getClaims();
    } catch {
        window.mediaferiaSession.clear();
        window.location.replace("/pages/login.html");
        return;
    }

    if (claims.rol !== "feriante") {
        window.location.replace("/pages/dashboard.html");
        return;
    }

    const paymentApp = document.querySelector("#payment-app");
    const formView = document.querySelector("#payment-form-view");
    const successView = document.querySelector("#payment-success");
    const paymentMessage = document.querySelector("#payment-message");
    const requestList = document.querySelector("#request-list");
    const testCheckoutButton = document.querySelector("#stripe-test-checkout");
    const euroFormat = new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR"
    });

    function showMessage(message, type) {
        paymentMessage.textContent = message;
        paymentMessage.dataset.type = type || "info";
        paymentMessage.hidden = false;
    }

    function createRequestCard(solicitud) {
        const card = document.createElement("article");
        card.className = "request-card";

        const heading = document.createElement("div");
        heading.className = "request-card-heading";

        const details = document.createElement("div");
        const fairName = document.createElement("h2");
        fairName.textContent = solicitud.feria;
        const spaceName = document.createElement("p");
        spaceName.className = "request-space";
        spaceName.textContent = solicitud.espacio;
        details.append(fairName, spaceName);

        const status = document.createElement("span");
        status.className = "request-status";
        status.textContent = solicitud.estadoPago === "pagado"
            ? "Pagada"
            : "Pendiente";
        heading.append(details, status);

        const total = document.createElement("div");
        total.className = "request-card-total";
        const totalLabel = document.createElement("span");
        totalLabel.textContent = "Importe del espacio";
        const amount = document.createElement("strong");
        amount.textContent = typeof solicitud.importe === "number"
            ? euroFormat.format(solicitud.importe)
            : "No disponible";
        total.append(totalLabel, amount);

        const button = document.createElement("button");
        button.className = "purchase--btn request-payment-button";
        button.type = "button";
        button.disabled = !solicitud.puedePagar;
        button.textContent = solicitud.estadoPago === "pagado"
            ? "Pago confirmado"
            : solicitud.puedePagar
                ? "Pagar con Stripe"
                : "Pago no disponible";
        button.addEventListener("click", () => iniciarCheckout(solicitud, button));

        card.append(heading, total, button);
        return card;
    }

    async function cargarSolicitudes() {
        requestList.replaceChildren();
        const loading = document.createElement("p");
        loading.className = "empty-list";
        loading.textContent = "Buscando solicitudes aprobadas…";
        requestList.append(loading);

        try {
            const response = await window.apiRequest("/api/pagos/solicitudes");

            if (!Array.isArray(response.solicitudes)) {
                throw new Error("El servidor devolvió una lista de pagos no válida.");
            }

            requestList.replaceChildren();

            if (response.solicitudes.length === 0) {
                const empty = document.createElement("p");
                empty.className = "empty-list";
                empty.textContent =
                    "Todavía no tienes solicitudes aprobadas para pagar.";
                requestList.append(empty);
                return;
            }

            for (const solicitud of response.solicitudes) {
                requestList.append(createRequestCard(solicitud));
            }
        } catch (error) {
            if (!sessionStorage.getItem("mediaferiaToken")) {
                window.location.replace("/pages/login.html");
                return;
            }

            requestList.replaceChildren();
            showMessage(error.message, "error");
        }
    }

    async function iniciarCheckout(solicitud, button) {
        button.disabled = true;
        button.textContent = "Conectando con Stripe…";
        paymentMessage.hidden = true;

        try {
            const response = await window.apiRequest("/api/pagos/checkout", {
                method: "POST",
                body: JSON.stringify({ solicitudId: solicitud.id })
            });
            const checkoutUrl = new URL(response.url);

            if (
                checkoutUrl.protocol !== "https:" ||
                checkoutUrl.hostname !== "checkout.stripe.com"
            ) {
                throw new Error("Stripe devolvió una dirección de checkout no válida.");
            }

            window.location.assign(checkoutUrl.href);
        } catch (error) {
            if (!sessionStorage.getItem("mediaferiaToken")) {
                window.location.replace("/pages/login.html");
                return;
            }

            showMessage(error.message, "error");
            button.disabled = false;
            button.textContent = "Reintentar con Stripe";
        }
    }

    async function iniciarCheckoutPrueba() {
        testCheckoutButton.disabled = true;
        testCheckoutButton.textContent = "Conectando con Stripe…";
        paymentMessage.hidden = true;

        try {
            const response = await window.apiRequest("/api/pagos/checkout-prueba", {
                method: "POST",
                body: JSON.stringify({})
            });
            const checkoutUrl = new URL(response.url);

            if (
                checkoutUrl.protocol !== "https:" ||
                checkoutUrl.hostname !== "checkout.stripe.com"
            ) {
                throw new Error("Stripe devolvió una dirección de checkout no válida.");
            }

            window.location.assign(checkoutUrl.href);
        } catch (error) {
            if (!sessionStorage.getItem("mediaferiaToken")) {
                window.location.replace("/pages/login.html");
                return;
            }

            showMessage(error.message, "error");
            testCheckoutButton.disabled = false;
            testCheckoutButton.textContent = "Reintentar redirección a Stripe";
        }
    }

    async function verificarPago(sessionId) {
        showMessage("Verificando el pago con Stripe…", "info");

        try {
            const response = await window.apiRequest(
                `/api/pagos/verificar?session_id=${encodeURIComponent(sessionId)}`
            );

            if (response.estado === "pagado") {
                formView.hidden = true;
                successView.hidden = false;
                return true;
            }

            showMessage(
                "Stripe todavía no confirma el pago. Actualiza la página en unos segundos.",
                "info"
            );
        } catch (error) {
            if (!sessionStorage.getItem("mediaferiaToken")) {
                window.location.replace("/pages/login.html");
                return false;
            }

            showMessage(error.message, "error");
        }

        return false;
    }

    paymentApp.hidden = false;
    testCheckoutButton.addEventListener("click", iniciarCheckoutPrueba);
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get("session_id");

    if (query.get("estado") === "cancelado") {
        showMessage(
            "Has cancelado el checkout. No se ha confirmado ningún pago; puedes intentarlo de nuevo.",
            "info"
        );
    }

    if (
        ["exito", "prueba"].includes(query.get("estado")) &&
        sessionId &&
        await verificarPago(sessionId)
    ) {
        return;
    }

    await cargarSolicitudes();
})();

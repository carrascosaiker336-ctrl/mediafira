let claims;

try {
    claims = window.mediaferiaSession.getClaims();
    document.body.dataset.rol = claims.rol;
    document.querySelectorAll("[data-roles]").forEach((link) => {
        const allowedRoles = link.dataset.roles.split(",");
        link.hidden = !allowedRoles.includes(claims.rol);
    });
} catch {
    window.mediaferiaSession.clear();
    window.location.replace("/pages/login.html");
}

document.querySelector("#logout").addEventListener("click", () => {
    window.mediaferiaSession.clear();
    window.location.replace("/pages/login.html");
});

if (claims && claims.rol === "feriante") {
    const paymentSummary = document.querySelector("#vendor-payment-summary");
    const pendingCount = document.querySelector("#vendor-pending-payments-count");

    window.apiRequest("/api/pagos/solicitudes")
        .then((response) => {
            if (!Array.isArray(response.solicitudes)) {
                throw new Error("No se pudo leer el estado de tus pagos.");
            }

            const solicitudesPendientes = response.solicitudes.filter(
                (solicitud) => solicitud.estadoPago !== "pagado" &&
                    solicitud.puedePagar
            ).length;

            pendingCount.textContent = String(solicitudesPendientes);
            paymentSummary.textContent = solicitudesPendientes
                ? `Tienes ${solicitudesPendientes} solicitud(es) aprobada(s) para pagar.`
                : "No tienes solicitudes aprobadas pendientes de pago.";
        })
        .catch((error) => {
            if (!sessionStorage.getItem("mediaferiaToken")) {
                window.location.replace("/pages/login.html");
                return;
            }

            paymentSummary.textContent = error.message;
        });
}

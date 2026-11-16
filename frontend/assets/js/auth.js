const loginForm = document.querySelector("#login-form");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.querySelector("#error");
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const formData = new FormData(loginForm);

    message.textContent = "";
    submitButton.disabled = true;

    try {
        const result = await window.apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify({
                email: formData.get("email"),
                password: formData.get("password")
            })
        });

        if (typeof result.token !== "string" || !result.token) {
            throw new Error("El servidor no devolvió un token de acceso.");
        }

        const rolesPermitidos = [
            "admin",
            "organizador",
            "ayuntamiento",
            "feriante"
        ];

        if (
            !result.usuario ||
            !rolesPermitidos.includes(result.usuario.rol)
        ) {
            throw new Error("El servidor no devolvió un perfil válido.");
        }

        sessionStorage.setItem("mediaferiaToken", result.token);
        window.location.assign(window.mediaferiaResolveUrl("/pages/dashboard.html"));
    } catch (error) {
        message.classList.remove("login-success");
        message.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});
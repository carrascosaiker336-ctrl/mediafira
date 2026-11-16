const form = document.querySelector("#form-registro");
const accountCard = document.querySelector("#caja");
const roleButtons = [...document.querySelectorAll(".rol[data-rol]")];
const message = document.querySelector("#error");
const submitButton = document.querySelector("#btn-registrar");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector("#btn-ver");
const identityDocumentInput = document.querySelector("#documento-identidad");
const identityDocumentLabel = document.querySelector("#tipo-documento");

const identityDocumentNames = {
    ayuntamiento: "NIF",
    organizador: "DNI",
    feriante: "DNI"
};

function showMessage(text, success = false) {
    message.textContent = text;
    message.classList.remove("oculto", "exito");
    message.setAttribute("role", success ? "status" : "alert");

    if (success) {
        message.classList.add("exito");
    }
}

roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
        accountCard.dataset.rol = button.dataset.rol;
        identityDocumentLabel.textContent =
            identityDocumentNames[button.dataset.rol];

        roleButtons.forEach((roleButton) => {
            const isSelected = roleButton === button;
            roleButton.classList.toggle("activo", isSelected);
            roleButton.setAttribute("aria-pressed", String(isSelected));
        });
    });
});

passwordToggle.addEventListener("click", () => {
    const showPassword = passwordInput.type === "password";
    passwordInput.type = showPassword ? "text" : "password";
    passwordToggle.textContent = showPassword ? "Ocultar" : "Mostrar";
    passwordToggle.setAttribute(
        "aria-label",
        showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
    );
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "";
    message.classList.add("oculto");

    if (!form.reportValidity()) {
        return;
    }

    const formData = new FormData(form);
    const identityDocument = formData.get("documentoIdentidad");

    if (!(identityDocument instanceof File) || identityDocument.size === 0) {
        showMessage("Adjunta tu documento de identidad para crear la cuenta.");
        identityDocumentInput.focus();
        return;
    }

    if (identityDocument.size > 5 * 1024 * 1024) {
        showMessage("El documento no puede superar los 5 MB.");
        identityDocumentInput.focus();
        return;
    }

    const nombre = [
        formData.get("nombre"),
        formData.get("apellido")
    ]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" ");

    submitButton.disabled = true;

    try {
        const documentData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => {
                if (typeof reader.result !== "string") {
                    reject(new Error("No se pudo leer el documento adjunto."));
                    return;
                }

                const separatorIndex = reader.result.indexOf(",");

                if (separatorIndex < 0) {
                    reject(new Error("El documento adjunto no tiene un formato válido."));
                    return;
                }

                resolve({
                    nombreArchivo: identityDocument.name,
                    tipoArchivo: identityDocument.type,
                    contenidoBase64: reader.result.slice(separatorIndex + 1)
                });
            });
            reader.addEventListener("error", () => {
                reject(new Error("No se pudo leer el documento adjunto."));
            });
            reader.readAsDataURL(identityDocument);
        });

        const result = await window.apiRequest("/api/usuarios", {
            method: "POST",
            body: JSON.stringify({
                nombre,
                email: formData.get("email").trim(),
                password: formData.get("password"),
                telefono: formData.get("telefono").trim(),
                rol: accountCard.dataset.rol,
                direccionFiscal: formData.get("direccionFiscal").trim(),
                documentoIdentidad: documentData
            })
        });

        form.reset();
        identityDocumentLabel.textContent = identityDocumentNames.ayuntamiento;
        accountCard.dataset.rol = "ayuntamiento";
        roleButtons.forEach((roleButton) => {
            const isSelected = roleButton.dataset.rol === "ayuntamiento";
            roleButton.classList.toggle("activo", isSelected);
            roleButton.setAttribute("aria-pressed", String(isSelected));
        });
        showMessage(
            `${result.mensaje} Ya puedes iniciar sesión.`,
            true
        );
    } catch (error) {
        showMessage(error.message);
    } finally {
        submitButton.disabled = false;
    }
});

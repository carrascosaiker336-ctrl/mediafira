# MediaFeria

## Iniciar el servidor

Desde la carpeta `backend`, instala dependencias la primera vez y arranca el
servidor:

```powershell
npm install
npm start
```

Configura `MONGODB_URI` y `JWT_SECRET` en `backend/.env`. El servidor lee
únicamente ese archivo y sus valores prevalecen sobre variables heredadas del
entorno. Si en algún momento usaste la variable antigua `MONGO_URI`, el
servidor la acepta como alias, pero la forma recomendada es `MONGODB_URI`.
Usa el puerto `3000` por defecto y permite configurar `PORT` y `HOST`; en
producción suele ser necesario `HOST=0.0.0.0`.
Configura también `JWT_SECRET` con al menos 32 caracteres aleatorios en el
mismo archivo; no lo subas al repositorio. Puedes generar uno localmente con:

```powershell
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

La aplicación web estará disponible en `http://127.0.0.1:3000/` y la
comprobación del servicio en `http://127.0.0.1:3000/api/health`. El inicio de
sesión está disponible mediante `POST /api/login` con JSON:

```json
{
  "email": "nombre@organismo.es",
  "password": "tu-contraseña"
}
```

El login devuelve un token Bearer válido durante 8 horas. Las demás rutas
`/api/*` requieren `Authorization: Bearer <token>`; `roleMiddleware` permite
restringir rutas a roles concretos.

El registro está disponible en `POST /api/usuarios` y no requiere token.
Permite los roles públicos `feriante`, `organizador` y `ayuntamiento`; el rol
`admin` no se puede solicitar desde el registro. Requiere nombre, correo y una
contraseña de al menos 12 caracteres, una dirección fiscal y un archivo de
identidad: DNI para feriantes y organizadores, NIF para ayuntamientos. Se
aceptan PDF, JPG y PNG de hasta 5 MB. El archivo se guarda como dato privado en
MongoDB y no se sirve como contenido estático. El backend también comprueba que
el archivo corresponda al tipo declarado. Las contraseñas nuevas se almacenan
con scrypt. Después de registrarse, usa `POST /api/login`; las cuentas creadas
con el nuevo flujo no pueden iniciar sesión si no tienen su documento guardado.
Las cuentas anteriores conservan el acceso. El dashboard muestra únicamente el
panel correspondiente al rol incluido en el token de sesión.

## Flujo de ferias y solicitudes

Los organizadores pueden enviar una feria al ayuntamiento asignado, incluyendo
fechas, localidad y el precio de sus espacios. La feria aparece para el
ayuntamiento como pendiente hasta que este la aprueba. Después, los feriantes
pueden solicitar plaza y consultar sus inscripciones. El organizador revisa la
solicitud; si la aprueba, el feriante puede pagar el precio del espacio mediante
Stripe Checkout en modo test. El apartado Chats permite conversaciones privadas
entre organizadores, ayuntamientos y feriantes.

## Datos de demostración

Para poblar una base de pruebas con seis cuentas, cuatro ferias y solicitudes,
ejecuta `npm run seed:demo` desde `backend`. El script solo se ejecuta si el
nombre de la base MongoDB contiene `test` o `demo`; crea dos cuentas de cada
perfil público y muestra contraseñas aleatorias una sola vez. No reutilices
esas cuentas en producción.

## Pagos con Stripe en modo test

El panel de feriante muestra solicitudes aprobadas pendientes de pago. El
checkout se crea en el backend usando el precio del espacio asociado a la
solicitud; Stripe aloja el formulario y los datos de tarjeta no pasan por
MediaFeria. La integración rechaza claves secretas que no sean `sk_test_`.

Configura la clave de prueba de Stripe en `backend/.env` (no la compartas ni la
subas al repositorio). El servidor acepta `STRIPE_SECRET_KEY` o `StripeApiKey`:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/mediaferia
JWT_SECRET=tu_clave_muy_segura
PORT=3000
HOST=127.0.0.1
APP_URL=http://127.0.0.1:3000
ALLOWED_ORIGINS=http://127.0.0.1:3000,https://mediaferia.onrender.com
StripeApiKey=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

En Render, añade exactamente `MONGODB_URI` y no `MONGO_URI` si quieres evitar
fallos de conexión. Si hay un frontend externo, además configura la whitelist
`ALLOWED_ORIGINS` con el dominio de Render o el dominio de producción.

Configura el webhook de Stripe para `POST /api/pagos/webhook` con los eventos
`checkout.session.completed` y `checkout.session.expired`. El retorno de
Checkout también verifica el estado de la sesión directamente con Stripe.
Solo el rol `feriante` puede listar y pagar sus propias solicitudes aprobadas.
La página incluye además un checkout de prueba aislado de 30,00 € para probar la
redirección; no crea ni modifica una solicitud de feria.

## Errores de arranque

- `Autenticación MongoDB fallida`: comprueba las credenciales de `MONGODB_URI`
  y codifica los caracteres reservados de la contraseña.
- `No se pudo alcanzar MongoDB`: comprueba el estado del clúster, la red y la
  lista de IP permitidas.
- `El puerto ... ya está ocupado`: detén el otro proceso o configura `PORT`.

Al recibir `Ctrl+C` o `SIGTERM`, el proceso deja de aceptar conexiones y cierra
MongoDB antes de salir.
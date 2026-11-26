# Sana: registro de cambios y guía de subida

Asistente virtual por voz y chat para agendar horas médicas (proyecto del ramo de Ingeniería, Innovación y Emprendimiento, UV).

## 1. Qué se modificó

**Backend (`backend/src/server.ts`)**
- Errores siempre en JSON (antes un body mal formado devolvía HTML y rompía el frontend).
- Modelos configurables con `GEMINI_MODELS` en el `.env` (por defecto `gemini-3.5-flash-lite`, luego `gemini-3.5-flash`). Se quitó `gemini-1.5-flash`, que ya no existe.
- Tiempo máximo por modelo: 40 s. El historial se normaliza a los roles `user` y `model`.
- Prompt de "Sana": solo habla de salud y horas médicas, español de Chile, frases cortas sin símbolos, no diagnostica, y ante una urgencia indica llamar al 131.
- Cuentas de usuario: registro, login (contraseña cifrada con scrypt, sesión de 7 días) y perfil editable.
- Citas: se registran desde el chat (etiqueta interna que el servidor valida y elimina del texto), se pueden cancelar desde el chat o desde "Mis citas", y no se duplican si el usuario ya tiene esa hora.
- Agenda simulada en Firestore (colección `agenda`, un documento por especialidad y día). Sana solo ofrece horas de esa lista, la reserva es una transacción (dos personas no pueden tomar la misma hora) y al cancelar la hora se libera.
- Voz de salida con Google Cloud Text-to-Speech (`es-US-Chirp3-HD-Aoede`, con respaldo `es-US-Neural2-A`).
- Usuarios y citas se guardan en `backend/data/db.json` (solo para el prototipo).

**Frontend (`backend/public/index.html`)**
- Portada con ilustración, registro e ingreso, y pestañas: Asistente, Mis citas y Mi perfil.
- Mis citas: próxima cita destacada, estado, cancelar y agregar al calendario (`.ics`).
- Modo noche elegible por el usuario (recuerda la elección).
- Botón grande "Hablar con Sana" para conversar por voz y sugerencias rápidas bajo el saludo.
- Versión móvil: pestañas abajo, chat ajustado a la pantalla, campos sin zoom en iPhone.
- Audio compatible con celulares (reproductor único desbloqueado con un toque).
- Aviso claro cuando el navegador (por ejemplo Brave) bloquea el reconocimiento de voz.

**Scripts (`backend/scripts/`)**
- `sembrar-agenda.ts`: crea la agenda de ejemplo (4 especialidades, próximos 14 días hábiles, unas 5 horas libres por día). Volver a correrlo deja libres las horas ya reservadas.
- `crear-store.ts`: crea el File Search store y sube los documentos de `backend/docs/`.

**Despliegue**
- VM de Google Cloud (`sana`), con `pm2` para mantener el servidor y Caddy para el https (necesario para el micrófono).

## 2. Archivos a subir

| Archivo descargado | Destino en el proyecto |
|---|---|
| `server.ts` | `backend/src/server.ts` |
| `index.html` | `backend/public/index.html` |
| `sembrar-agenda.ts` | `backend/scripts/sembrar-agenda.ts` |
| `CAMBIOS.md` | `CAMBIOS.md` (raíz del proyecto) |

## 3. Pasos para subir (en tu WSL)

Antes de empezar, borra de Descargas las copias antiguas de estos archivos. Si no, los nombres nuevos terminan en `(1)` y el `cp` copiaría el viejo.

```bash
cd /mnt/c/Users/Usuario/Desktop/proyecto
mkdir -p backend/scripts
cp /mnt/c/Users/Usuario/Downloads/server.ts backend/src/server.ts
cp /mnt/c/Users/Usuario/Downloads/index.html backend/public/index.html
cp /mnt/c/Users/Usuario/Downloads/sembrar-agenda.ts backend/scripts/sembrar-agenda.ts
cp /mnt/c/Users/Usuario/Downloads/CAMBIOS.md CAMBIOS.md

git pull --no-edit
git status
git add .
git commit -m "Agenda en Firestore, modo noche, versión móvil y botón de voz"
git push
```

Revisa que `git status` no muestre `.env` ni `node_modules`. Si el push pide credenciales: usuario `enzoverri` y tu token de GitHub como contraseña.

## 4. Pasos para actualizar la VM

Entra desde tu WSL con `gcloud compute ssh sana --zone=us-central1-a`. Cuando el prompt diga `Verri@sana`:

```bash
cd ~/sana
git checkout backend/src/server.ts   # descarta cambios manuales hechos en la VM
git pull
cd backend
pnpm install
pm2 restart sana --update-env
pm2 logs sana --lines 20 --nostream
```

Si cambiaste la agenda de ejemplo o quieres reiniciarla antes de la feria: `pnpm exec tsx scripts/sembrar-agenda.ts`.

Después recarga la página (si se ve igual, ciérrala y ábrela de nuevo).

## 5. Variables de entorno (`backend/.env`, no se sube)

Copia esto a `backend/.env.example` (sin valores reales) para que quien clone el proyecto sepa qué configurar:

```
GEMINI_API_KEY=
FILE_SEARCH_STORE_NAME=
JWT_SECRET=
GEMINI_MODELS=gemini-3.5-flash-lite,gemini-3.5-flash
```

## 6. Cómo correrlo desde cero

```bash
cd backend
pnpm install
cp .env.example .env     # completa los valores
pnpm exec tsx scripts/sembrar-agenda.ts
pnpm exec tsx src/server.ts
```

Abre `http://localhost:3000`. Necesita credenciales de Google Cloud (`gcloud auth application-default login`) para Firestore y para la voz.

## 7. Limitaciones conocidas

- Usuarios y citas están en un archivo JSON; en producción irían en una base de datos real.
- La agenda de Firestore es de ejemplo; en un servicio real se conectaría al sistema de agenda de la clínica.
- Brave y Safari en iPhone pueden fallar con el micrófono. Chrome o Edge funcionan mejor.
- El control de que Sana no se salga del tema depende del prompt y no es infalible.

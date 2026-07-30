# Votación — concurso de monólogos

App de votación en vivo para 5 participantes, con conteo compartido entre
todos los móviles que accedan por QR, cuenta atrás de 10 minutos, control
manual del organizador y registro de resultados por año.

## Archivos

- `votar.html` — pantalla de voto (lo que se accede desde el QR).
- `resultados.html` — pantalla de resultados en vivo, pensada para proyector.
- `organizador.html` — panel de control (crear edición, iniciar votación, cerrar, publicar resultados, ver historial).
- `common.js` / `firebase-config.js` / `styles.css` — lógica y estilos compartidos.

## Cómo funciona

- **Una edición por año.** Desde el panel del organizador creas una edición
  (año, fecha y los 5 nombres). Se guarda con su propio identificador, así
  que los resultados de cada año no se mezclan y quedan en el historial.
- **QR único.** `votar.html` siempre apunta a la "edición activa" (la última
  que hayas creado o activado desde el historial). Reparte un solo link/QR
  el día del evento.
- **Un voto por dispositivo/navegador** (no por persona real): se guarda un
  identificador aleatorio en el móvil de cada votante. Alguien podría volver
  a votar en incógnito o desde otro móvil; para blindaje total haría falta
  pedir un dato de registro, lo que rompe el objetivo de "sin fricción". Para
  un concurso amateur en vivo se considera suficiente (mismo criterio que en
  la versión anterior del proyecto).
- **Cuenta atrás de 10 minutos:** el organizador pulsa "Iniciar votación" y
  todos los móviles ven la misma cuenta atrás (sincronizada contra el reloj
  del servidor, no el del móvil). Al llegar a 0 solo se muestra un aviso
  visual — la votación sigue abierta hasta que el organizador pulsa
  "Cerrar votación".
- **Resultados ocultos hasta publicarlos:** `resultados.html` no muestra
  nada hasta que el organizador pulsa "Publicar resultados" desde su panel.
  Se puede volver a ocultar en cualquier momento con el mismo botón. El
  organizador, en cambio, siempre ve el conteo en directo en su propio panel.
- **Historial:** el panel del organizador lista todas las ediciones creadas,
  con sus 5 participantes y el recuento final de votos de cada una.

## Configurar Firebase (una vez, antes del primer evento)

Los votos y el estado de la votación se guardan en Firebase Realtime
Database para que todos los móviles vean lo mismo en tiempo real. Es
gratuito para este volumen de uso.

1. Ve a https://console.firebase.google.com/ y crea un proyecto nuevo (no
   hace falta tarjeta de crédito).
2. En el menú lateral, entra en **Build → Realtime Database** y pulsa
   "Crear base de datos". Elige la ubicación más cercana. Cuando pregunte
   por las reglas de seguridad, empieza en **modo de prueba** (luego las
   sustituimos, ver abajo).
3. Ve a **Configuración del proyecto** (icono de engranaje) → pestaña
   **General** → sección "Tus apps" → añade una app **Web** (icono `</>`).
   No hace falta Firebase Hosting, solo registrar la app.
4. Copia el objeto `firebaseConfig` que te muestra y pégalo en
   `firebase-config.js`, sustituyendo los valores `TU_...`.
5. En **Realtime Database → Reglas**, pega esto y publica:

   ```json
   {
     "rules": {
       ".read": true,
       "editions": {
         ".write": true
       },
       "votes": {
         ".write": true
       },
       "activeEditionId": {
         ".write": true
       }
     }
   }
   ```

   **Nota de seguridad:** estas reglas son de lectura/escritura abiertas —
   equivalentes al "modo de prueba" de Firebase. Cualquiera que inspeccione
   el código de la página podría, en teoría, escribir votos falsos o tocar
   el panel sin pasar por el código de organizador. Para un concurso amateur
   en vivo se considera un riesgo aceptable (igual que el código `MONOLOGO`
   de la versión anterior, que tampoco es seguridad real). Si en el futuro
   quieres blindarlo, la mejora natural es añadir Firebase Authentication
   (login del organizador) y restringir las reglas a usuarios autenticados.

6. Sube estos archivos a donde sirvas la web (por ejemplo, GitHub Pages de
   este mismo repo) y comparte el link de `votar.html` (o su QR, generado
   automáticamente en el panel del organizador) el día del evento.

## Antes del evento

- Cambia el código de acceso del organizador editando la constante
  `ORGANIZER_CODE` en `organizador.html` (por defecto: `MONOLOGO`).
- Crea la edición del año con los 5 nombres reales desde el panel.
- Haz una prueba: abre `votar.html` desde tu móvil, inicia la votación,
  vota, y comprueba `resultados.html` en el proyector antes de publicar.

## Pendiente / posibles mejoras futuras

- [ ] Fotos de los participantes en las tarjetas de voto.
- [ ] Exportar el historial de votos a CSV desde el panel.
- [ ] Autenticación real del organizador (Firebase Auth) si se quiere
      cerrar el hueco de seguridad descrito arriba.

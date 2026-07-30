# Votación — concurso de monólogos

App de votación en vivo, autoalojada (Node.js + SQLite, sin dependencias
externas de pago), para un concurso de 5 participantes. Registro de
ediciones por año, cuenta atrás de 10 minutos, resultados ocultos hasta
que el organizador los publica, y login real solo para el administrador.

## Cómo está montado

- **Backend propio:** `server.js` (Express + Socket.IO) + `db.js` (SQLite
  vía `better-sqlite3`, un único archivo `data/votacion.db`). No usa
  Firebase ni ningún servicio externo — todo vive en tu servidor.
- **Público general, sin registro:** `public/votar.html` es la pantalla de
  voto (destino del QR) y `public/resultados.html` la de resultados para
  proyector. Nadie necesita cuenta para acceder a ellas.
- **Administrador, con cuenta real:** `public/admin-login.html` y
  `public/admin.html`. Usuario + contraseña con hash `bcrypt`, sesión
  guardada en una cookie `httpOnly` firmada (JWT). El registro de esa
  cuenta está protegido por un código que solo tú conoces
  (`ADMIN_SETUP_TOKEN`), así que el público no puede crearse una cuenta de
  organizador.
- **Estado en vivo:** los cambios (votos, inicio de cuenta atrás, cierre,
  publicar/ocultar resultados) se empujan por WebSocket (Socket.IO) a
  todos los móviles conectados — no hay que refrescar la página.

## Modelo de una edición

- Una "edición" = un año del concurso: fecha + 5 nombres + sus votos.
- El panel del organizador siempre tiene una **edición activa**, que es la
  que ve el público en `votar.html`/`resultados.html`. Al crear una edición
  nueva se activa automáticamente; también puedes volver a activar una
  edición anterior desde el historial.
- El historial del panel lista todas las ediciones creadas con sus 5
  participantes y el recuento final de votos — así queda el registro por
  año.
- Un voto por dispositivo/navegador: el servidor pone una cookie
  `httpOnly` (no manipulable desde JavaScript) la primera vez que alguien
  entra, y la base de datos tiene una restricción única
  (edición, dispositivo) que impide votar dos veces aunque alguien
  manipule el cliente. Sigue sin ser "una persona, un voto" real —
  alguien podría votar otra vez en incógnito o desde otro móvil— pero es
  más difícil de saltarse que la versión anterior basada solo en
  `localStorage`.
- Al terminar los 10 minutos solo se muestra un aviso visual; la votación
  sigue abierta hasta que el organizador pulsa "Cerrar votación".
- Publicar resultados es reversible: puedes mostrarlos y volver a
  ocultarlos cuando quieras desde el panel.

## Desplegar sin administrar un servidor (recomendado): Railway

Si no quieres manejar SSH, nginx ni certificados, la forma más simple es
un PaaS como [Railway](https://railway.app): conectas el repo de GitHub y
él se encarga de instalar, arrancar y darte HTTPS.

1. Entra en https://railway.app y crea una cuenta (puedes usar tu GitHub).
2. **New Project → Deploy from GitHub repo** → elige `lencichu/Personal`.
   Railway te pedirá autorizar el acceso a tus repos la primera vez.
3. En la configuración del servicio que se crea (pestaña **Settings**),
   busca **Root Directory** y ponlo a `votacion-monologos` — es
   imprescindible, porque el repo tiene más proyectos aparte de este.
4. En **Variables**, añade estas (mismos valores que en `.env.example`,
   pero rellenados de verdad):
   - `SESSION_SECRET` — cadena larga y aleatoria.
   - `ADMIN_SETUP_TOKEN` — el código que usarás tú una vez para crear tu
     cuenta de administrador.
   - `NODE_ENV` = `production`
   - `DATA_DIR` = `/data`
   - No hace falta poner `PORT`, Railway lo asigna solo.
5. En la pestaña **Volumes**, añade un volumen y móntalo en `/data`. Esto
   es lo que hace que los votos sobrevivan a futuros despliegues — sin
   esto, cada vez que subas un cambio se perdería la base de datos.
6. Pulsa **Deploy**. Cuando termine, en **Settings → Networking** genera
   un dominio público (botón "Generate Domain"): te da una URL con HTTPS
   ya incluido, tipo `algo.up.railway.app`. Puedes apuntar tu propio
   dominio ahí también si tienes uno, desde la misma pestaña.
7. Abre `https://tu-url/admin-login.html` y registra tu cuenta de
   administrador con el `ADMIN_SETUP_TOKEN` que pusiste en el paso 4.

Coste aproximado: el plan Hobby de Railway son 5 $/mes de base, que suelen
cubrir de sobra el uso de una app tan ligera como esta.

Cualquier cambio que subas a la rama que hayas conectado se volverá a
desplegar solo. Si más adelante prefieres pasarte a tu propio servidor,
la sección siguiente explica esa vía.

## Alternativa: tu propio servidor (VPS)

Esta vía es más barata (un VPS pequeño de Hetzner o similar ronda 4-5
€/mes) pero exige que sigas los pasos por terminal (SSH) tú mismo, o que
me des acceso a la máquina para hacerlo por ti.

### Requisitos del servidor

- Node.js 18 o superior (probado con Node 22).
- Un dominio o IP donde alojarlo, idealmente con HTTPS (necesario para que
  las cookies de sesión funcionen bien en producción y para que el
  micrófono/cámara u otras APIs del móvil no den problemas, aunque esta
  app no las usa).

### Puesta en marcha

```bash
cd votacion-monologos
npm install
cp .env.example .env
```

Edita `.env`:

- `SESSION_SECRET`: cadena larga y aleatoria (`openssl rand -hex 32`).
- `ADMIN_SETUP_TOKEN`: código que usarás tú mismo, una vez, para crear tu
  cuenta de administrador. Después de crear la cuenta puedes dejarlo o
  cambiarlo por otro (con eso invalidas registros futuros con el antiguo).
- `PORT`: puerto donde escuchará el proceso Node (por defecto 3000).
- `NODE_ENV=production` en el servidor real (hace que las cookies solo
  viajen por HTTPS).

Arrancar:

```bash
npm start
```

Esto deja el servidor escuchando en `http://localhost:PORT`. La base de
datos se crea sola en `data/votacion.db` la primera vez.

### Mantenerlo corriendo (systemd, ejemplo)

```ini
# /etc/systemd/system/votacion-monologos.service
[Unit]
Description=Votacion monologos
After=network.target

[Service]
WorkingDirectory=/ruta/a/votacion-monologos
ExecStart=/usr/bin/node server.js
Restart=on-failure
EnvironmentFile=/ruta/a/votacion-monologos/.env
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now votacion-monologos
```

### Exponerlo con HTTPS (nginx + certbot, ejemplo)

```nginx
server {
    listen 80;
    server_name votacion.tudominio.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Luego `certbot --nginx -d votacion.tudominio.com` para el certificado.
El `Upgrade`/`Connection` es imprescindible: sin él, Socket.IO no puede
mantener la conexión en vivo.

## Primer uso

1. Entra en `https://tu-dominio/admin-login.html` → "¿Primera vez?
   Registrar administrador" → usuario, contraseña y el `ADMIN_SETUP_TOKEN`
   que pusiste en `.env`.
2. En el panel, crea la edición del año con los 5 nombres reales.
3. Comparte el link/QR de `votar.html` (se genera solo en el panel) el
   día del evento.
4. Pulsa "Iniciar votación" cuando toque, "Cerrar votación" cuando
   termine, y "Publicar resultados" cuando quieras que se vean.

## Copias de seguridad

Todo el estado (ediciones, votos, cuenta de administrador) vive en un
único archivo SQLite: `data/votacion.db` (o `<DATA_DIR>/votacion.db` si
usas la variable `DATA_DIR`, como en Railway). Descárgalo y guárdalo tras
cada evento si quieres conservar el histórico fuera del servidor.

## Pendiente / posibles mejoras futuras

- [ ] Fotos de los participantes en las tarjetas de voto.
- [ ] Exportar el historial de votos a CSV desde el panel.
- [ ] Registro de varias cuentas de administrador con roles distintos, si
      alguna vez hace falta que organice más de una persona.

// Lógica compartida entre votar.html y resultados.html.
// admin.html tiene la suya propia porque además necesita autenticación.
const socket = io();

let serverTimeOffset = 0;
fetch('/api/time')
  .then((r) => r.json())
  .then(({ now }) => {
    serverTimeOffset = now - Date.now();
  })
  .catch(() => {});

function serverNow() {
  return Date.now() + serverTimeOffset;
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// Llama a cb con el estado público cada vez que cambie, y una vez al cargar.
function onState(cb) {
  socket.on('state', cb);
  fetch('/api/state')
    .then((r) => r.json())
    .then(cb)
    .catch(() => {});
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

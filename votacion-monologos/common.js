// Lógica compartida entre votar.html, resultados.html y organizador.html.
const db = firebase.database();

function getVoterId() {
  let id = localStorage.getItem('votante_id');
  if (!id) {
    id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('votante_id', id);
  }
  return id;
}

function hasVotedLocally(editionId) {
  return localStorage.getItem('votado_' + editionId) === '1';
}

function markVotedLocally(editionId) {
  localStorage.setItem('votado_' + editionId, '1');
}

// Firebase expone el desfase entre el reloj del servidor y el del dispositivo,
// así la cuenta atrás se ve igual en todos los móviles aunque su hora local falle.
let serverTimeOffset = 0;
db.ref('.info/serverTimeOffset').on('value', (snap) => {
  serverTimeOffset = snap.val() || 0;
});
function serverNow() {
  return Date.now() + serverTimeOffset;
}

// Escucha la edición activa (la que está en votacion-monologos ahora mismo) y
// llama a callback(editionId, editionData) cada vez que cambie algo.
function watchActiveEdition(callback) {
  let editionRef = null;
  db.ref('activeEditionId').on('value', (snap) => {
    if (editionRef) editionRef.off();
    const id = snap.val();
    if (!id) {
      callback(null, null);
      return;
    }
    editionRef = db.ref('editions/' + id);
    editionRef.on('value', (editionSnap) => {
      callback(id, editionSnap.val());
    });
  });
}

// Devuelve una función para desuscribir el listener cuando ya no haga falta.
function countVotes(editionId, callback) {
  const ref = db.ref('votes/' + editionId);
  const handler = ref.on('value', (snap) => {
    const counts = [0, 0, 0, 0, 0];
    let total = 0;
    snap.forEach((child) => {
      const idx = child.val();
      if (idx >= 0 && idx <= 4) {
        counts[idx]++;
        total++;
      }
    });
    callback(counts, total);
  });
  return () => ref.off('value', handler);
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

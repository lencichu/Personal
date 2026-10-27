// Curva de dificultad del modo infinito.
// Cada "tier" son 3 goles. En el tier 0 el portero esta quieto (para que
// el primer contacto con el juego sea facil de leer); a partir del tier 1
// se mueve de lado a lado a velocidad constante, cada vez mas rapido.
// A partir del tier 2 aparece una barrera de dos defensores a los costados
// del arquero, que tapan el centro y obligan a buscar los huecos laterales.
function getDifficulty(score) {
  const tier = Math.floor(score / 3);
  const distance = 11 + tier * 2;
  const keeperMoves = tier >= 1;
  const keeperPatrolSpeed = keeperMoves ? Math.min(150, 55 + (tier - 1) * 14) : 0;
  const visualDistanceScale = Math.max(0.72, 1 - tier * 0.03);
  const wallActive = tier >= 2;
  return { tier, distance, keeperMoves, keeperPatrolSpeed, visualDistanceScale, wallActive };
}

// Curva de dificultad del modo infinito.
// Cada "tier" son 3 goles. Sube la distancia mostrada, la velocidad de
// reaccion del portero y baja su tiempo de reaccion.
function getDifficulty(score) {
  const tier = Math.floor(score / 3);
  const distance = 11 + tier * 2;
  const keeperMaxSpeed = Math.min(260, 90 + tier * 18);
  const keeperReactionMs = Math.max(110, 320 - tier * 15);
  const visualDistanceScale = Math.max(0.72, 1 - tier * 0.03);
  return { tier, distance, keeperMaxSpeed, keeperReactionMs, visualDistanceScale };
}

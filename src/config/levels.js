// Configuracion de niveles. Ajusta estos valores para cambiar la dificultad.
// wallDefenders: numero de "familiares" en la barrera
// wallSpeed: velocidad de desplazamiento lateral de la barrera (px/s)
// goalHalfWidth: mitad del ancho de la porteria (px)
// shotsAllowed: intentos de tiro disponibles
// goalsToWin: goles necesarios para pasar de nivel
const LEVELS = [
  {
    id: 1,
    title: 'Nivel 1 - Patio de casa',
    wallDefenders: 2,
    wallSpeed: 55,
    goalHalfWidth: 105,
    shotsAllowed: 5,
    goalsToWin: 3,
  },
  {
    id: 2,
    title: 'Nivel 2 - Parque',
    wallDefenders: 3,
    wallSpeed: 80,
    goalHalfWidth: 90,
    shotsAllowed: 5,
    goalsToWin: 3,
  },
  {
    id: 3,
    title: 'Nivel 3 - Estadio familiar',
    wallDefenders: 4,
    wallSpeed: 110,
    goalHalfWidth: 75,
    shotsAllowed: 6,
    goalsToWin: 4,
  },
];

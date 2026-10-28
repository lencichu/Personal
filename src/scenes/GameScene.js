const MatterBody = Phaser.Physics.Matter.Matter.Body;

const FIELD_WIDTH = 480;
const FIELD_HEIGHT = 800;
const CENTER_X = FIELD_WIDTH / 2;

// Espacio logico (para fisica/colisiones). No es lo mismo que la pantalla.
const BALL_LOGICAL_START = { x: CENTER_X, y: 710 };
const GOAL_LOGICAL_Y = 130;
// El portero se para cerca de su propia linea (no a mitad de cancha), igual
// que en la realidad: asi la porteria no queda tapada y el tiro tiene
// recorrido de sobra para curvarse antes de llegar a el.
const KEEPER_LOGICAL_Y = 175;
const GOAL_HALF_WIDTH = 130;
const GOAL_HEIGHT_LOGICAL = 85;
const SIDE_MARGIN = 30;

// Transformacion en perspectiva para que se vea el balon en primer plano
// y la porteria/portero al fondo, como en el juego original.
const FOREGROUND_Y = 560;
const HORIZON_Y = 280;
const PERSPECTIVE_FACTOR = 0.5;
const BALL_SCALE_NEAR = 3.6;
// El balon casi al fondo tiene que verse chico frente al arco, no como una
// pelota de playa; el portero igual, bastante mas bajo que el travesano.
const BALL_SCALE_FAR = 0.22;
const KEEPER_SCALE_NEAR = 0.65;
const KEEPER_SCALE_FAR = 0.5;

// Barrera de defensores que aparece en dificultad alta (ver difficulty.js).
const WALL_OFFSET = 90;
const WALL_WIDTH = 34;
const WALL_HEIGHT = 70;
const WALL_GAP = 6;
const WALL_TINT = 0xe05a5a;
const KEEPER_HALF_WIDTH = 25;

const MIN_DRAG = 40;
const MAX_DRAG = 260;
const MIN_SPEED = 10;
const MAX_SPEED = 20;
const MAX_DX = 160;
const MAX_ANGLE_RAD = Phaser.Math.DegToRad(28);
// El efecto se aplica durante todo el vuelo (no solo al salir el tiro), para
// que la pelota se vaya curvando de a poco como una rosca real en vez de
// pegar un "tiron" cerca del pie y despues seguir derecha el resto del
// camino. CURVE_DECAY es por frame a 60fps: con 0.996 el empuje lateral
// sigue bien presente incluso pasado un segundo de vuelo.
const CURVE_STRENGTH = 12;
const CURVE_DECAY = 0.996;
const STOP_SPEED_THRESHOLD = 0.6;
// Angulo de giro (primera mitad del trazo vs. segunda) que ya da el efecto
// maximo. Mas alla de esto no se gana mas curva, solo hace falta un giro
// mas marcado para llegar al tope.
const CURVE_ANGLE_REF = Phaser.Math.DegToRad(40);
const MIN_POINT_SPACING = 4;

const START_LIVES = 3;
const HIGH_SCORE_KEY = 'flickKickFamily_highScore';

function depthT(logicalY) {
  const t = (BALL_LOGICAL_START.y - logicalY) / (BALL_LOGICAL_START.y - GOAL_LOGICAL_Y);
  return Phaser.Math.Clamp(t, 0, 1);
}

function toScreen(logicalX, logicalY) {
  const t = depthT(logicalY);
  const spread = Phaser.Math.Linear(1, PERSPECTIVE_FACTOR, t);
  return {
    x: CENTER_X + (logicalX - CENTER_X) * spread,
    y: Phaser.Math.Linear(FOREGROUND_Y, HORIZON_Y, t),
    t,
  };
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init() {
    this.score = 0;
    this.lives = START_LIVES;
    this.streak = 0;
    this.highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    this.difficulty = getDifficulty(this.score);
    this.currentTier = -1;
    this.wallActive = false;

    this.shotInFlight = false;
    this.shotResolved = false;
    this.canShoot = true;
    this.dragging = false;
    this.dragPoints = [];
    this.curveAccel = 0;
    this.paused = false;
  }

  create() {
    this.createBackground();
    this.createPitch();
    this.createGoalPhysics();
    this.createBounds();
    this.applyDifficultyVisuals(true);
    this.createKeeper();
    this.refreshWall();
    this.createBall();
    this.createHud();
    this.createPauseOverlay();
    this.createInput();

    this.matter.world.on('collisionstart', this.handleCollision, this);
  }

  createGoalPhysics() {
    const leftX = CENTER_X - GOAL_HALF_WIDTH;
    const rightX = CENTER_X + GOAL_HALF_WIDTH;

    this.matter.add.rectangle(leftX, GOAL_LOGICAL_Y + 25, 8, 60, { isStatic: true, label: 'post' });
    this.matter.add.rectangle(rightX, GOAL_LOGICAL_Y + 25, 8, 60, { isStatic: true, label: 'post' });

    this.matter.add.rectangle(CENTER_X, GOAL_LOGICAL_Y - 6, GOAL_HALF_WIDTH * 2 - 10, 14, {
      isStatic: true,
      isSensor: true,
      label: 'goalSensor',
    });

    this.matter.add.rectangle(CENTER_X, GOAL_LOGICAL_Y - 34, GOAL_HALF_WIDTH * 2 - 10, 10, {
      isStatic: true,
      label: 'net',
      restitution: 0.05,
    });
  }

  createBounds() {
    const leftX = CENTER_X - GOAL_HALF_WIDTH;
    const rightX = CENTER_X + GOAL_HALF_WIDTH;
    const wallY = GOAL_LOGICAL_Y - 4;

    const leftSegW = leftX - SIDE_MARGIN;
    const rightSegW = FIELD_WIDTH - SIDE_MARGIN - rightX;

    this.matter.add.rectangle(SIDE_MARGIN + leftSegW / 2, wallY, leftSegW, 16, {
      isStatic: true,
      label: 'backWall',
    });
    this.matter.add.rectangle(rightX + rightSegW / 2, wallY, rightSegW, 16, {
      isStatic: true,
      label: 'backWall',
    });

    this.matter.add.rectangle(SIDE_MARGIN / 2, FIELD_HEIGHT / 2, SIDE_MARGIN, FIELD_HEIGHT, {
      isStatic: true,
      label: 'sideWall',
    });
    this.matter.add.rectangle(FIELD_WIDTH - SIDE_MARGIN / 2, FIELD_HEIGHT / 2, SIDE_MARGIN, FIELD_HEIGHT, {
      isStatic: true,
      label: 'sideWall',
    });
  }

  // ---------- Escenario ----------

  createBackground() {
    this.add.rectangle(CENTER_X, 100, FIELD_WIDTH, 200, 0x3f9fdc);
    this.add.rectangle(CENTER_X, 230, FIELD_WIDTH, 60, 0x7fc4e8);

    this.crowd = this.add.tileSprite(CENTER_X, 340, FIELD_WIDTH, 120, 'crowd_pattern');

    this.add.rectangle(CENTER_X, 268, FIELD_WIDTH, 16, 0x9fb4c2);
    for (let x = 20; x < FIELD_WIDTH; x += 60) {
      this.add.circle(x, 260, 4, 0xf2f2f2);
    }
  }

  createPitch() {
    const pitch = this.add.graphics();
    pitch.fillStyle(0x1e7a34, 1);
    pitch.beginPath();
    pitch.moveTo(0, FIELD_HEIGHT);
    pitch.lineTo(FIELD_WIDTH, FIELD_HEIGHT);
    pitch.lineTo(CENTER_X + (FIELD_WIDTH / 2) * PERSPECTIVE_FACTOR, HORIZON_Y);
    pitch.lineTo(CENTER_X - (FIELD_WIDTH / 2) * PERSPECTIVE_FACTOR, HORIZON_Y);
    pitch.closePath();
    pitch.fillPath();

    pitch.lineStyle(3, 0xffffff, 0.35);
    for (let i = 1; i <= 3; i++) {
      const ly = Phaser.Math.Linear(FIELD_HEIGHT, HORIZON_Y, i / 4);
      const t = depthT(Phaser.Math.Linear(BALL_LOGICAL_START.y, GOAL_LOGICAL_Y, i / 4));
      const spread = Phaser.Math.Linear(1, PERSPECTIVE_FACTOR, t);
      const halfW = (FIELD_WIDTH / 2) * spread;
      pitch.beginPath();
      pitch.moveTo(CENTER_X - halfW, ly);
      pitch.lineTo(CENTER_X + halfW, ly);
      pitch.strokePath();
    }

    this.goalGraphics = this.add.graphics();
  }

  applyDifficultyVisuals(force) {
    const d = this.difficulty;
    if (!force && d.tier === this.currentTier) return;
    this.currentTier = d.tier;

    const scale = d.visualDistanceScale;
    const leftX = CENTER_X - GOAL_HALF_WIDTH;
    const rightX = CENTER_X + GOAL_HALF_WIDTH;
    const leftScreen = toScreen(leftX, GOAL_LOGICAL_Y);
    const rightScreen = toScreen(rightX, GOAL_LOGICAL_Y);
    // Misma logica de perspectiva que el ancho (toScreen), para que el arco
    // mantenga una proporcion realista en vez de verse casi cuadrado.
    const postH = GOAL_HEIGHT_LOGICAL * PERSPECTIVE_FACTOR * scale;

    this.goalGraphics.clear();
    this.goalGraphics.lineStyle(2, 0xffffff, 0.5);
    for (let gx = leftScreen.x; gx <= rightScreen.x; gx += 10) {
      this.goalGraphics.lineBetween(gx, HORIZON_Y, gx, HORIZON_Y + postH);
    }
    for (let gy = HORIZON_Y; gy <= HORIZON_Y + postH; gy += 8) {
      this.goalGraphics.lineBetween(leftScreen.x, gy, rightScreen.x, gy);
    }
    this.goalGraphics.fillStyle(0xffffff, 1);
    this.goalGraphics.fillRect(leftScreen.x - 3, HORIZON_Y - 4, 6, postH + 4);
    this.goalGraphics.fillRect(rightScreen.x - 3, HORIZON_Y - 4, 6, postH + 4);
    this.goalGraphics.fillRect(leftScreen.x - 3, HORIZON_Y - 4, rightScreen.x - leftScreen.x + 6, 5);

    if (this.keeperSprite) {
      this.keeperBaseScale = Phaser.Math.Linear(KEEPER_SCALE_NEAR, KEEPER_SCALE_FAR, depthT(KEEPER_LOGICAL_Y)) * scale;
    }
    if (this.wallSprites) {
      this.syncWallVisual();
    }
  }

  // ---------- Portero ----------
  // Se mueve a velocidad constante de un lado a otro (sin reaccionar al
  // tiro), para que el jugador pueda calcular el hueco. Por debajo del
  // tier 1 de dificultad se queda quieto en el centro.

  createKeeper() {
    this.keeperBody = this.matter.add.rectangle(CENTER_X, KEEPER_LOGICAL_Y, 50, 90, {
      isStatic: true,
      label: 'keeper',
    });

    this.keeperBaseScale = Phaser.Math.Linear(KEEPER_SCALE_NEAR, KEEPER_SCALE_FAR, depthT(KEEPER_LOGICAL_Y));
    this.keeperSprite = this.add.image(CENTER_X, HORIZON_Y, 'defender_placeholder');
    this.syncKeeperVisual();

    this.keeperDirection = 1;
    this.keeperLeftLimit = CENTER_X - GOAL_HALF_WIDTH + KEEPER_HALF_WIDTH;
    this.keeperRightLimit = CENTER_X + GOAL_HALF_WIDTH - KEEPER_HALF_WIDTH;
  }

  syncKeeperVisual() {
    const screen = toScreen(this.keeperBody.position.x, KEEPER_LOGICAL_Y);
    this.keeperSprite.setPosition(screen.x, screen.y).setScale(this.keeperBaseScale);
  }

  updateKeeperPatrol(delta) {
    if (!this.difficulty.keeperMoves) return;

    const current = this.keeperBody.position.x;
    let next = current + this.keeperDirection * this.difficulty.keeperPatrolSpeed * (delta / 1000);

    if (next >= this.keeperRightLimit) {
      next = this.keeperRightLimit;
      this.keeperDirection = -1;
    } else if (next <= this.keeperLeftLimit) {
      next = this.keeperLeftLimit;
      this.keeperDirection = 1;
    }

    MatterBody.setPosition(this.keeperBody, { x: next, y: KEEPER_LOGICAL_Y });
    this.syncKeeperVisual();
  }

  // ---------- Barrera ----------
  // Dos defensores fijos a los costados del arquero, que aparecen en
  // dificultad alta (ver difficulty.js). No se mueven: tapan el centro y
  // dejan los huecos laterales (entre barrera y palo) como vias de gol.

  refreshWall() {
    if (this.difficulty.wallActive && !this.wallActive) {
      this.wallActive = true;
      this.createWallDefenders();

      const corridorHalf = WALL_OFFSET - WALL_WIDTH / 2 - WALL_GAP - KEEPER_HALF_WIDTH;
      this.keeperLeftLimit = Math.max(this.keeperLeftLimit, CENTER_X - corridorHalf);
      this.keeperRightLimit = Math.min(this.keeperRightLimit, CENTER_X + corridorHalf);

      const clampedX = Phaser.Math.Clamp(this.keeperBody.position.x, this.keeperLeftLimit, this.keeperRightLimit);
      MatterBody.setPosition(this.keeperBody, { x: clampedX, y: KEEPER_LOGICAL_Y });
      this.syncKeeperVisual();
    } else if (this.wallActive) {
      this.syncWallVisual();
    }
  }

  createWallDefenders() {
    this.wallBodies = [];
    this.wallSprites = [];
    for (const side of [-1, 1]) {
      const x = CENTER_X + side * WALL_OFFSET;
      const body = this.matter.add.rectangle(x, KEEPER_LOGICAL_Y, WALL_WIDTH, WALL_HEIGHT, {
        isStatic: true,
        label: 'wallDefender',
      });
      const sprite = this.add.image(CENTER_X, HORIZON_Y, 'defender_placeholder').setTint(WALL_TINT);
      this.wallBodies.push(body);
      this.wallSprites.push(sprite);
    }
    this.syncWallVisual();
  }

  syncWallVisual() {
    this.wallBodies.forEach((body, i) => {
      const screen = toScreen(body.position.x, KEEPER_LOGICAL_Y);
      this.wallSprites[i].setPosition(screen.x, screen.y).setScale(this.keeperBaseScale * 0.92);
    });
  }

  // ---------- Balon ----------

  createBall() {
    this.ballBody = this.matter.add.circle(BALL_LOGICAL_START.x, BALL_LOGICAL_START.y, 16, {
      restitution: 0.55,
      frictionAir: 0.02,
      friction: 0,
      label: 'ball',
    });

    this.ballShadow = this.add.ellipse(CENTER_X, FOREGROUND_Y + 18, 60, 16, 0x000000, 0.35);
    this.ballSprite = this.add.image(CENTER_X, FOREGROUND_Y, 'ball').setScale(BALL_SCALE_NEAR);
  }

  syncBallVisual() {
    const pos = this.ballBody.position;
    const screen = toScreen(pos.x, pos.y);
    const scale = Phaser.Math.Linear(BALL_SCALE_NEAR, BALL_SCALE_FAR, screen.t);

    this.ballSprite.setPosition(screen.x, screen.y).setScale(scale);
    this.ballShadow.setPosition(screen.x, screen.y + 6 * scale);
    this.ballShadow.setScale(scale);
    this.ballShadow.setAlpha(0.35 * (1 - screen.t * 0.6));
  }

  // ---------- HUD ----------

  createHud() {
    this.add.text(16, 16, 'PUNTUACION', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
    });

    this.scoreText = this.add.text(16, 36, '0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#00000055',
      padding: { x: 10, y: 4 },
    });

    this.add.text(16, 78, 'MAXIMA PUNTUACION', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff',
    });

    this.highScoreText = this.add.text(16, 94, String(this.highScore), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    });

    this.add.text(FIELD_WIDTH - 16, 16, 'VIDAS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(1, 0);

    this.lifeIcons = [];
    for (let i = 0; i < START_LIVES; i++) {
      const icon = this.add.image(FIELD_WIDTH - 24 - i * 30, 44, 'ball').setScale(0.7);
      this.lifeIcons.unshift(icon);
    }

    this.distText = this.add.text(16, FIELD_HEIGHT - 34, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#2b1d0e',
      backgroundColor: '#f2e6c9',
      padding: { x: 10, y: 6 },
    });

    this.pauseButton = this.add
      .text(FIELD_WIDTH - 46, FIELD_HEIGHT - 40, 'II', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#2b1d0e',
        backgroundColor: '#f2e6c9',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true });
    this.pauseButton.on('pointerdown', () => this.togglePause());

    this.messageText = this.add
      .text(CENTER_X, HORIZON_Y + 60, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.aimGraphics = this.add.graphics();
    this.comboGraphics = this.add.graphics().setDepth(5);
    this.messageText.setDepth(6);

    this.updateHud();
  }

  updateHud() {
    this.scoreText.setText(String(this.score));
    this.highScoreText.setText(String(this.highScore));
    this.distText.setText(`DIST.\n${this.difficulty.distance} M`);
    this.lifeIcons.forEach((icon, i) => {
      const lost = i >= this.lives;
      icon.setTint(lost ? 0x666666 : 0xffffff);
      icon.setAlpha(lost ? 0.4 : 1);
    });
  }

  createPauseOverlay() {
    this.pauseOverlay = this.add.container(0, 0).setDepth(100).setVisible(false);
    const bg = this.add.rectangle(CENTER_X, FIELD_HEIGHT / 2, FIELD_WIDTH, FIELD_HEIGHT, 0x000000, 0.6);
    const label = this.add
      .text(CENTER_X, FIELD_HEIGHT / 2, 'PAUSA\nToca para continuar', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);
    bg.setInteractive();
    bg.on('pointerdown', () => this.togglePause());
    this.pauseOverlay.add([bg, label]);
  }

  togglePause() {
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    if (this.paused) {
      this.matter.world.pause();
    } else {
      this.matter.world.resume();
    }
  }

  // ---------- Input ----------

  createInput() {
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
  }

  onPointerDown(pointer) {
    if (!this.canShoot || this.paused) return;
    this.dragging = true;
    this.dragStart = { x: pointer.x, y: pointer.y };
    this.dragPoints = [{ x: pointer.x, y: pointer.y }];
  }

  onPointerMove(pointer) {
    if (!this.dragging) return;

    const last = this.dragPoints[this.dragPoints.length - 1];
    if (Phaser.Math.Distance.Between(last.x, last.y, pointer.x, pointer.y) >= MIN_POINT_SPACING) {
      this.dragPoints.push({ x: pointer.x, y: pointer.y });
    }

    const dx = pointer.x - this.dragStart.x;
    const dy = this.dragStart.y - pointer.y;
    const power = Phaser.Math.Clamp(dy / MAX_DRAG, 0, 1);
    const curveNorm = this.computeCurveNorm(this.dragPoints);

    this.aimGraphics.clear();
    if (dy > 10) {
      const ready = dy >= MIN_DRAG;
      // Amarillo = tiro recto, celeste/naranja = curva hacia un lado u otro.
      const curveColor = curveNorm > 0.08 ? 0x4fc3f7 : curveNorm < -0.08 ? 0xff8a65 : 0xffe066;
      const color = ready ? curveColor : 0x888888;

      this.aimGraphics.lineStyle(4, color, 0.9);
      this.aimGraphics.beginPath();
      this.aimGraphics.moveTo(this.ballSprite.x, this.ballSprite.y);
      for (const p of this.dragPoints) {
        const px = p.x - this.dragStart.x;
        const py = this.dragStart.y - p.y;
        this.aimGraphics.lineTo(this.ballSprite.x + px * 0.6, this.ballSprite.y - py * 0.6);
      }
      this.aimGraphics.strokePath();

      const tip = this.dragPoints[this.dragPoints.length - 1];
      const tpx = tip.x - this.dragStart.x;
      const tpy = this.dragStart.y - tip.y;
      this.aimGraphics.fillStyle(color, 0.9);
      this.aimGraphics.fillCircle(this.ballSprite.x + tpx * 0.6, this.ballSprite.y - tpy * 0.6, 4 + power * 6);
    }
  }

  onPointerUp(pointer) {
    if (!this.dragging) return;
    this.dragging = false;
    this.aimGraphics.clear();

    const dx = pointer.x - this.dragStart.x;
    const dy = this.dragStart.y - pointer.y;
    const curveNorm = this.computeCurveNorm(this.dragPoints);
    this.dragPoints = [];

    if (dy < MIN_DRAG) return;

    this.shoot(dx, dy, curveNorm);
  }

  // Compara hacia donde apunta la primera mitad del gesto contra la segunda
  // mitad: el angulo firmado entre esas dos direcciones es cuanto "giro" el
  // dedo. Girar hacia la derecha da curva a la derecha, sin importar de que
  // lado de la linea recta inicio-fin haya quedado el trazo (una curva
  // natural, que se va cerrando hacia un lado sin volver al centro, cae del
  // lado contrario de esa linea recta, por eso comparar contra ella daba el
  // efecto invertido).
  computeCurveNorm(points) {
    if (!points || points.length < 3) return 0;

    const first = points[0];
    const mid = points[Math.floor(points.length / 2)];
    const last = points[points.length - 1];

    const dir1x = mid.x - first.x;
    const dir1y = mid.y - first.y;
    const dir2x = last.x - mid.x;
    const dir2y = last.y - mid.y;

    const len1 = Math.hypot(dir1x, dir1y);
    const len2 = Math.hypot(dir2x, dir2y);
    if (len1 < 1 || len2 < 1) return 0;

    const cross = dir1x * dir2y - dir1y * dir2x;
    const dot = dir1x * dir2x + dir1y * dir2y;
    const turnAngle = Math.atan2(cross, dot);

    return Phaser.Math.Clamp(turnAngle / CURVE_ANGLE_REF, -1, 1);
  }

  shoot(dx, dy, curveNorm = 0) {
    const powerNorm = Phaser.Math.Clamp((dy - MIN_DRAG) / (MAX_DRAG - MIN_DRAG), 0, 1);
    const speed = Phaser.Math.Linear(MIN_SPEED, MAX_SPEED, powerNorm);
    const clampedDx = Phaser.Math.Clamp(dx, -MAX_DX, MAX_DX);
    const angle = (clampedDx / MAX_DX) * MAX_ANGLE_RAD;

    const vx = Math.sin(angle) * speed;
    const vy = -Math.cos(angle) * speed;

    MatterBody.setVelocity(this.ballBody, { x: vx, y: vy });

    this.curveAccel = curveNorm * CURVE_STRENGTH;
    this.shotInFlight = true;
    this.shotResolved = false;
    this.canShoot = false;
  }

  // ---------- Resolucion de disparo ----------

  handleCollision(event) {
    if (this.shotResolved || !this.shotInFlight) return;

    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (labels.includes('ball') && labels.includes('goalSensor')) {
        this.resolveShot('goal');
        return;
      }
      if (labels.includes('ball') && labels.includes('keeper')) {
        this.resolveShot('saved');
        return;
      }
      if (labels.includes('ball') && labels.includes('wallDefender')) {
        this.resolveShot('blocked');
        return;
      }
      if (labels.includes('ball') && labels.includes('backWall')) {
        this.resolveShot('wide');
        return;
      }
      if (labels.includes('ball') && labels.includes('sideWall')) {
        this.resolveShot('wide');
        return;
      }
      if (labels.includes('ball') && labels.includes('post')) {
        this.resolveShot('wide');
        return;
      }
    }
  }

  resolveShot(outcome) {
    if (this.shotResolved) return;
    this.shotResolved = true;
    this.shotInFlight = false;
    this.curveAccel = 0;
    MatterBody.setVelocity(this.ballBody, { x: 0, y: 0 });

    let comboTriggered = false;

    if (outcome === 'goal') {
      this.score += 1;
      this.streak += 1;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      }
      this.difficulty = getDifficulty(this.score);

      if (this.streak > 0 && this.streak % 3 === 0) {
        comboTriggered = true;
        this.showComboCelebration(this.streak);
      } else {
        this.showMessage('¡GOL!', '#ffe066');
      }
    } else {
      this.streak = 0;
      this.lives -= 1;
      const labels = { saved: '¡PARADA!', wide: 'FUERA', stopped: 'CORTO', blocked: '¡BLOQUEADO!' };
      this.showMessage(labels[outcome] || 'FALLO', '#ff6b6b');
    }

    this.updateHud();
    this.applyDifficultyVisuals(false);
    this.refreshWall();

    this.time.delayedCall(comboTriggered ? 1500 : 900, () => this.afterShot());
  }

  showMessage(text, color) {
    this.messageText.setText(text);
    this.messageText.setColor(color);
    this.messageText.setAlpha(1);
    this.messageText.setScale(0.7);
    this.tweens.add({
      targets: this.messageText,
      scale: 1,
      alpha: { from: 1, to: 0 },
      duration: 850,
      ease: 'Cubic.Out',
    });
  }

  // Estrella de celebracion dibujada a mano (sin assets), para la racha de
  // goles seguidos: un poligono con puntas alternando radio largo/corto.
  drawStarburst(graphics, cx, cy, spikes, outerRadius, innerRadius, color) {
    graphics.clear();
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    const total = spikes * 2;
    for (let i = 0; i < total; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) graphics.moveTo(x, y);
      else graphics.lineTo(x, y);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  showComboCelebration(streakCount) {
    const cx = CENTER_X;
    const cy = HORIZON_Y + 60;

    // Se dibuja centrado en el origen local y se posiciona el objeto en
    // (cx, cy), para que el tween de escala haga "pop" desde su propio
    // centro en vez de estirarse desde la esquina del mundo.
    this.drawStarburst(this.comboGraphics, 0, 0, 10, 95, 60, 0xffce33);
    this.comboGraphics.setPosition(cx, cy).setAlpha(1);
    this.comboGraphics.setScale(0.5);

    this.messageText.setText(`¡${streakCount}\nSEGUIDOS!`);
    this.messageText.setColor('#7a3b00');
    this.messageText.setAlign('center');
    this.messageText.setAlpha(1);
    this.messageText.setScale(0.5);

    this.tweens.add({
      targets: [this.comboGraphics, this.messageText],
      scale: 1,
      duration: 280,
      ease: 'Back.Out',
    });
    this.tweens.add({
      targets: [this.comboGraphics, this.messageText],
      alpha: { from: 1, to: 0 },
      delay: 750,
      duration: 500,
      ease: 'Cubic.Out',
      onComplete: () => this.comboGraphics.clear(),
    });
  }

  afterShot() {
    MatterBody.setPosition(this.ballBody, { x: BALL_LOGICAL_START.x, y: BALL_LOGICAL_START.y });
    MatterBody.setVelocity(this.ballBody, { x: 0, y: 0 });
    this.syncBallVisual();

    if (this.lives <= 0) {
      this.scene.start('ResultScene', {
        score: this.score,
        highScore: this.highScore,
        isNewRecord: this.score >= this.highScore && this.score > 0,
      });
      return;
    }

    this.canShoot = true;
  }

  // ---------- Bucle principal ----------

  update(time, delta) {
    if (this.paused) return;

    this.crowd.tilePositionX += 0.03 * delta;

    this.updateKeeperPatrol(delta);
    this.syncBallVisual();

    if (this.shotInFlight) {
      const v = this.ballBody.velocity;
      if (Math.abs(this.curveAccel) > 0.01) {
        MatterBody.setVelocity(this.ballBody, {
          x: v.x + this.curveAccel * (delta / 1000),
          y: v.y,
        });
        this.curveAccel *= Math.pow(CURVE_DECAY, delta / (1000 / 60));
      }

      const speed = Math.hypot(v.x, v.y);
      if (speed < STOP_SPEED_THRESHOLD) {
        this.resolveShot('stopped');
      }
    }
  }
}

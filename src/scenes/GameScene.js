const MatterBody = Phaser.Physics.Matter.Matter.Body;

const FIELD_WIDTH = 480;
const FIELD_HEIGHT = 800;
const BALL_START = { x: FIELD_WIDTH / 2, y: 710 };
const GOAL_CENTER_X = FIELD_WIDTH / 2;
const GOAL_LINE_Y = 130;
const WALL_Y = 430;
const SIDE_MARGIN = 30;

const MIN_DRAG = 40;
const MAX_DRAG = 260;
const MIN_SPEED = 10;
const MAX_SPEED = 20;
const MAX_DX = 160;
const MAX_ANGLE_RAD = Phaser.Math.DegToRad(38);
const CURVE_STRENGTH = 5.5;
const CURVE_DECAY = 0.994;
const STOP_SPEED_THRESHOLD = 0.6;

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.levelIndex = data.levelIndex || 0;
    this.level = LEVELS[this.levelIndex];
    this.goalsScored = 0;
    this.shotsRemaining = this.level.shotsAllowed;
    this.shotInFlight = false;
    this.shotResolved = false;
    this.canShoot = true;
    this.dragging = false;
    this.curveAccel = 0;
  }

  create() {
    this.createField();
    this.createGoal();
    this.createBackWalls();
    this.createSideWalls();
    this.createDefenders();
    this.createBall();
    this.createHud();
    this.createInput();

    this.matter.world.on('collisionstart', this.handleCollision, this);
  }

  createField() {
    this.add.rectangle(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, FIELD_WIDTH, FIELD_HEIGHT, 0x1b6b2c);
    for (let y = 60; y < FIELD_HEIGHT; y += 80) {
      this.add.rectangle(FIELD_WIDTH / 2, y, FIELD_WIDTH, 40, 0x1f7a32).setAlpha(0.5);
    }
    this.add.circle(GOAL_CENTER_X, 560, 55).setStrokeStyle(2, 0xffffff, 0.5);
  }

  createGoal() {
    const halfW = this.level.goalHalfWidth;
    const leftX = GOAL_CENTER_X - halfW;
    const rightX = GOAL_CENTER_X + halfW;

    this.add.rectangle(GOAL_CENTER_X, GOAL_LINE_Y, halfW * 2, 4, 0xffffff);
    this.add.image(leftX, GOAL_LINE_Y + 25, 'post');
    this.add.image(rightX, GOAL_LINE_Y + 25, 'post');

    this.matter.add.rectangle(leftX, GOAL_LINE_Y + 25, 8, 60, { isStatic: true, label: 'post' });
    this.matter.add.rectangle(rightX, GOAL_LINE_Y + 25, 8, 60, { isStatic: true, label: 'post' });

    this.matter.add.rectangle(GOAL_CENTER_X, GOAL_LINE_Y - 6, halfW * 2 - 10, 14, {
      isStatic: true,
      isSensor: true,
      label: 'goalSensor',
    });

    this.matter.add.rectangle(GOAL_CENTER_X, GOAL_LINE_Y - 34, halfW * 2 - 10, 10, {
      isStatic: true,
      label: 'net',
      restitution: 0.05,
    });
  }

  createBackWalls() {
    const halfW = this.level.goalHalfWidth;
    const leftX = GOAL_CENTER_X - halfW;
    const rightX = GOAL_CENTER_X + halfW;
    const wallY = GOAL_LINE_Y - 4;

    const leftSegW = leftX - SIDE_MARGIN;
    const rightSegW = FIELD_WIDTH - SIDE_MARGIN - rightX;

    this.add.rectangle(SIDE_MARGIN + leftSegW / 2, wallY, leftSegW, 16, 0x0a2410);
    this.add.rectangle(rightX + rightSegW / 2, wallY, rightSegW, 16, 0x0a2410);

    this.matter.add.rectangle(SIDE_MARGIN + leftSegW / 2, wallY, leftSegW, 16, {
      isStatic: true,
      label: 'backWall',
    });
    this.matter.add.rectangle(rightX + rightSegW / 2, wallY, rightSegW, 16, {
      isStatic: true,
      label: 'backWall',
    });
  }

  createSideWalls() {
    this.matter.add.rectangle(SIDE_MARGIN / 2, FIELD_HEIGHT / 2, SIDE_MARGIN, FIELD_HEIGHT, {
      isStatic: true,
      label: 'sideWall',
    });
    this.matter.add.rectangle(FIELD_WIDTH - SIDE_MARGIN / 2, FIELD_HEIGHT / 2, SIDE_MARGIN, FIELD_HEIGHT, {
      isStatic: true,
      label: 'sideWall',
    });
  }

  createDefenders() {
    const halfW = this.level.goalHalfWidth;
    const rangeMin = GOAL_CENTER_X - halfW - 30;
    const rangeMax = GOAL_CENTER_X + halfW + 30;
    const rangeWidth = rangeMax - rangeMin;
    const count = this.level.wallDefenders;

    this.defenders = [];
    for (let i = 0; i < count; i++) {
      const baseX = rangeMin + (rangeWidth / count) * (i + 0.5);
      const amplitude = rangeWidth / count / 2 + 15;
      const phase = i * (Math.PI / 2);
      const speedFactor = (this.level.wallSpeed / 1000) * (0.8 + Math.random() * 0.4);

      const img = this.matter.add.image(baseX, WALL_Y, 'defender_placeholder', null, {
        isStatic: true,
        label: 'defender',
      });

      this.defenders.push({ img, baseX, amplitude, phase, speedFactor });
    }
  }

  createBall() {
    this.ball = this.matter.add.image(BALL_START.x, BALL_START.y, 'ball', null, {
      shape: { type: 'circle', radius: 16 },
      restitution: 0.55,
      frictionAir: 0.02,
      friction: 0,
      label: 'ball',
    });
  }

  createHud() {
    this.add
      .text(FIELD_WIDTH / 2, 24, this.level.title, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.goalsText = this.add.text(16, 50, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    });

    this.shotsText = this.add.text(FIELD_WIDTH - 16, 50, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(1, 0);

    this.messageText = this.add
      .text(FIELD_WIDTH / 2, 250, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.aimGraphics = this.add.graphics();

    this.updateHud();
  }

  createInput() {
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
  }

  onPointerDown(pointer) {
    if (!this.canShoot) return;
    this.dragging = true;
    this.dragStart = { x: pointer.x, y: pointer.y };
  }

  onPointerMove(pointer) {
    if (!this.dragging) return;
    const dx = pointer.x - this.dragStart.x;
    const dy = this.dragStart.y - pointer.y;
    const power = Phaser.Math.Clamp(dy / MAX_DRAG, 0, 1);

    this.aimGraphics.clear();
    if (dy > 10) {
      const color = dy >= MIN_DRAG ? 0xffe066 : 0x888888;
      this.aimGraphics.lineStyle(4, color, 0.9);
      this.aimGraphics.beginPath();
      this.aimGraphics.moveTo(this.ball.x, this.ball.y);
      this.aimGraphics.lineTo(this.ball.x + dx * 0.6, this.ball.y - dy * 0.6);
      this.aimGraphics.strokePath();
      this.aimGraphics.fillStyle(color, 0.9);
      this.aimGraphics.fillCircle(this.ball.x + dx * 0.6, this.ball.y - dy * 0.6, 4 + power * 6);
    }
  }

  onPointerUp(pointer) {
    if (!this.dragging) return;
    this.dragging = false;
    this.aimGraphics.clear();

    const dx = pointer.x - this.dragStart.x;
    const dy = this.dragStart.y - pointer.y;

    if (dy < MIN_DRAG) return;

    this.shoot(dx, dy);
  }

  shoot(dx, dy) {
    const powerNorm = Phaser.Math.Clamp((dy - MIN_DRAG) / (MAX_DRAG - MIN_DRAG), 0, 1);
    const speed = Phaser.Math.Linear(MIN_SPEED, MAX_SPEED, powerNorm);
    const clampedDx = Phaser.Math.Clamp(dx, -MAX_DX, MAX_DX);
    const angle = (clampedDx / MAX_DX) * MAX_ANGLE_RAD;

    const vx = Math.sin(angle) * speed;
    const vy = -Math.cos(angle) * speed;

    MatterBody.setVelocity(this.ball.body, { x: vx, y: vy });

    this.curveAccel = (clampedDx / MAX_DX) * CURVE_STRENGTH;
    this.shotInFlight = true;
    this.shotResolved = false;
    this.canShoot = false;
    this.shotsRemaining -= 1;
    this.updateHud();
  }

  handleCollision(event) {
    if (this.shotResolved || !this.shotInFlight) return;

    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (labels.includes('ball') && labels.includes('goalSensor')) {
        this.resolveShot('goal');
        return;
      }
      if (labels.includes('ball') && labels.includes('defender')) {
        this.resolveShot('blocked');
        return;
      }
      if (labels.includes('ball') && labels.includes('backWall')) {
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
    MatterBody.setVelocity(this.ball.body, { x: 0, y: 0 });

    if (outcome === 'goal') {
      this.goalsScored += 1;
      this.showMessage('¡GOL!', '#ffe066');
    } else if (outcome === 'blocked') {
      this.showMessage('¡BLOQUEADO!', '#ff6b6b');
    } else if (outcome === 'wide') {
      this.showMessage('FUERA', '#ff6b6b');
    } else {
      this.showMessage('CORTO', '#ff6b6b');
    }

    this.updateHud();

    this.time.delayedCall(900, () => this.afterShot());
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

  afterShot() {
    MatterBody.setPosition(this.ball.body, { x: BALL_START.x, y: BALL_START.y });
    MatterBody.setVelocity(this.ball.body, { x: 0, y: 0 });

    if (this.goalsScored >= this.level.goalsToWin || this.shotsRemaining <= 0) {
      this.endLevel();
      return;
    }

    this.canShoot = true;
  }

  endLevel() {
    const won = this.goalsScored >= this.level.goalsToWin;
    this.time.delayedCall(300, () => {
      this.scene.start('ResultScene', {
        won,
        goalsScored: this.goalsScored,
        goalsToWin: this.level.goalsToWin,
        levelIndex: this.levelIndex,
        isLastLevel: this.levelIndex >= LEVELS.length - 1,
      });
    });
  }

  updateHud() {
    this.goalsText.setText(`Goles: ${this.goalsScored}/${this.level.goalsToWin}`);
    this.shotsText.setText(`Tiros: ${this.shotsRemaining}`);
  }

  update(time, delta) {
    for (const d of this.defenders) {
      const newX = d.baseX + d.amplitude * Math.sin(time * d.speedFactor + d.phase);
      d.img.setPosition(newX, WALL_Y);
    }

    if (this.shotInFlight) {
      const v = this.ball.body.velocity;
      MatterBody.setVelocity(this.ball.body, {
        x: v.x + this.curveAccel * (delta / 1000),
        y: v.y,
      });
      this.curveAccel *= CURVE_DECAY;

      const speed = Math.hypot(v.x, v.y);
      if (speed < STOP_SPEED_THRESHOLD) {
        this.resolveShot('stopped');
      }
    }
  }
}

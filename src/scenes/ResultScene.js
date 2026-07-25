class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  init(data) {
    this.result = data;
  }

  create() {
    const { width, height } = this.scale;
    const { won, goalsScored, goalsToWin, levelIndex, isLastLevel } = this.result;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d3d15);

    const title = won ? (isLastLevel ? '¡JUEGO COMPLETADO!' : '¡NIVEL SUPERADO!') : 'INTENTALO OTRA VEZ';
    const titleColor = won ? '#ffe066' : '#ff8a8a';

    this.add
      .text(width / 2, height * 0.28, title, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: titleColor,
        align: 'center',
        wordWrap: { width: width - 60 },
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.4, `Goles: ${goalsScored}/${goalsToWin}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    if (won && isLastLevel) {
      this.add
        .text(width / 2, height * 0.48, '¡Enhorabuena, campeón de la familia!', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: '#dfffe0',
          align: 'center',
          wordWrap: { width: width - 80 },
        })
        .setOrigin(0.5);
    }

    let mainLabel;
    let mainAction;

    if (won && !isLastLevel) {
      mainLabel = 'SIGUIENTE NIVEL';
      mainAction = () => this.scene.start('GameScene', { levelIndex: levelIndex + 1 });
    } else if (won && isLastLevel) {
      mainLabel = 'JUGAR DE NUEVO';
      mainAction = () => this.scene.start('GameScene', { levelIndex: 0 });
    } else {
      mainLabel = 'REINTENTAR';
      mainAction = () => this.scene.start('GameScene', { levelIndex });
    }

    const mainButton = this.add
      .text(width / 2, height * 0.62, mainLabel, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#0d3d15',
        backgroundColor: '#ffffff',
        padding: { x: 32, y: 14 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    mainButton.on('pointerdown', mainAction);

    const menuButton = this.add
      .text(width / 2, height * 0.74, 'MENU', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#dfffe0',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    menuButton.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}

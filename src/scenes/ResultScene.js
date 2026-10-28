class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  init(data) {
    this.result = data;
  }

  create() {
    const { width, height } = this.scale;
    const { score, highScore, isNewRecord } = this.result;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d3d15);

    this.add
      .text(width / 2, height * 0.24, 'FIN DE LA PARTIDA', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ff8a8a',
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.36, `Goles marcados: ${score}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.43, `Maxima puntuacion: ${highScore}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#dfffe0',
      })
      .setOrigin(0.5);

    if (isNewRecord) {
      this.add
        .text(width / 2, height * 0.5, '¡NUEVO RECORD!', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#ffe066',
        })
        .setOrigin(0.5);
    }

    const playButton = this.add
      .text(width / 2, height * 0.64, 'JUGAR DE NUEVO', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#0d3d15',
        backgroundColor: '#ffffff',
        padding: { x: 28, y: 14 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playButton.on('pointerdown', () => {
      this.registry.get('sfx').tap();
      this.scene.start('GameScene');
    });

    const menuButton = this.add
      .text(width / 2, height * 0.75, 'MENU', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#dfffe0',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    menuButton.on('pointerdown', () => {
      this.registry.get('sfx').tap();
      this.scene.start('MenuScene');
    });
  }
}

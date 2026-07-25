class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d3d15);

    this.add
      .text(width / 2, height * 0.22, 'FLICK KICK\nFAMILY', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);

    this.add.image(width / 2, height * 0.4, 'ball').setScale(2.5);

    this.add
      .text(
        width / 2,
        height * 0.52,
        'Desliza el dedo hacia arriba para chutar.\nCuanto mas largo el gesto, mas potencia.\nInclina el gesto a un lado para dar efecto.',
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: '#dfffe0',
          align: 'center',
        }
      )
      .setOrigin(0.5);

    const playButton = this.add
      .text(width / 2, height * 0.72, 'JUGAR', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#0d3d15',
        backgroundColor: '#ffffff',
        padding: { x: 40, y: 16 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playButton.on('pointerdown', () => {
      this.registry.set('levelIndex', 0);
      this.registry.set('totalScore', 0);
      this.scene.start('GameScene', { levelIndex: 0 });
    });

    this.add
      .text(width / 2, height * 0.85, 'v0.1 - prototipo', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#7fbf8f',
      })
      .setOrigin(0.5);
  }
}

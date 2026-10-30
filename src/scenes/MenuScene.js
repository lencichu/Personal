class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d3d15);

    const bg = this.add.image(width / 2, height / 2, 'title_enzo');
    const coverScale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(coverScale);

    const panelY = height * 0.78;
    this.add.rectangle(width / 2, panelY, width, height * 0.44, 0x0d3d15, 0.65).setOrigin(0.5, 0);

    const highScore = parseInt(localStorage.getItem('flickKickFamily_highScore') || '0', 10);
    this.add
      .text(width / 2, panelY + 18, `Maxima puntuacion: ${highScore}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#ffe066',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, panelY + 46, 'Desliza hacia arriba para chutar. Inclina para dar efecto. Un toque suave pasa por arriba de la barrera.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#dfffe0',
        align: 'center',
        wordWrap: { width: width - 60 },
      })
      .setOrigin(0.5);

    const playButton = this.add
      .text(width / 2, panelY + 92, 'JUGAR', {
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
      this.registry.get('sfx').tap();
      this.scene.start('CharacterSelectScene');
    });

    this.add
      .text(width / 2, height - 12, 'v0.3 - prototipo', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#7fbf8f',
      })
      .setOrigin(0.5, 1);
  }
}

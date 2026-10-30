class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelectScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d3d15);

    this.add
      .text(width / 2, height * 0.14, 'ELEGI TU JUGADOR', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffe066',
      })
      .setOrigin(0.5);

    const slotY = height * 0.42;
    const spacing = width / (CHARACTERS.length + 1);

    CHARACTERS.forEach((character, i) => {
      const x = spacing * (i + 1);

      const portrait = this.add
        .image(x, slotY, 'avatar_placeholder')
        .setTint(character.tint)
        .setScale(1.3)
        .setInteractive({ useHandCursor: true });

      this.add.circle(x, slotY, 44).setStrokeStyle(3, 0xffffff, 0.6);

      this.add
        .text(x, slotY + 64, character.name, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);

      portrait.on('pointerdown', () => {
        this.registry.get('sfx').tap();
        this.registry.set('selectedCharacter', character);
        this.scene.start('GameScene');
      });
    });

    const backButton = this.add
      .text(width / 2, height * 0.9, 'VOLVER', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#dfffe0',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerdown', () => {
      this.registry.get('sfx').tap();
      this.scene.start('MenuScene');
    });
  }
}

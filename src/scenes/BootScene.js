class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.image('title_enzo', 'assets/familia/title-enzo.png');
    this.load.image('ball', 'assets/familia/ball.png');
    this.load.image('keeper_photo', 'assets/familia/keeper.png');
  }

  create() {
    this.generatePlaceholderTextures();
    this.registry.set('sfx', new SoundManager());
    this.registry.set('selectedCharacter', CHARACTERS[0]);
    this.scene.start('MenuScene');
  }

  generatePlaceholderTextures() {
    const g = this.add.graphics();

    // Defensor de la barrera: placeholder hasta tener la foto de un familiar
    // (el arquero ya usa 'keeper_photo', cargada en preload()).
    g.clear();
    g.fillStyle(0x3355aa, 1);
    g.fillRoundedRect(4, 20, 32, 40, 8);
    g.fillStyle(0xffd8a8, 1);
    g.fillCircle(20, 14, 14);
    g.generateTexture('defender_placeholder', 40, 62);

    // Patron de grada: cabezas de colores sobre fondo oscuro (placeholder de publico)
    g.clear();
    g.fillStyle(0x1c2733, 1);
    g.fillRect(0, 0, 48, 26);
    const crowdColors = [0xffffff, 0xffcc33, 0xff5555, 0x5588ff, 0x55cc77, 0xffffff];
    for (let i = 0; i < 14; i++) {
      const cx = Phaser.Math.Between(2, 46);
      const cy = Phaser.Math.Between(2, 24);
      const color = crowdColors[Phaser.Math.Between(0, crowdColors.length - 1)];
      g.fillStyle(color, 1);
      g.fillCircle(cx, cy, Phaser.Math.Between(2, 3));
    }
    g.generateTexture('crowd_pattern', 48, 26);

    // Avatar generico para la pantalla de seleccion de jugador: circulo +
    // silueta de busto en un solo tono, para que el tinte por jugador
    // (CHARACTERS) coloree todo el avatar de forma pareja.
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(32, 32, 32);
    g.fillStyle(0x0d3d15, 1);
    g.fillCircle(32, 24, 11);
    g.fillEllipse(32, 52, 34, 26);
    g.generateTexture('avatar_placeholder', 64, 64);

    g.destroy();
  }
}

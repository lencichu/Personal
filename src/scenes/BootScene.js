class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.generatePlaceholderTextures();
    this.scene.start('MenuScene');
  }

  generatePlaceholderTextures() {
    const g = this.add.graphics();

    // Balon: circulo blanco con parches oscuros (se puede sustituir luego por una foto)
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 16);
    g.fillStyle(0x222222, 1);
    g.fillCircle(16, 16, 5);
    g.fillTriangle(16, 6, 22, 12, 10, 12);
    g.fillTriangle(16, 26, 22, 20, 10, 20);
    g.lineStyle(1, 0x999999, 1);
    g.strokeCircle(16, 16, 15);
    g.generateTexture('ball', 32, 32);

    // Defensor placeholder: cuerpo + cabeza, listo para sustituir por foto de familiar
    g.clear();
    g.fillStyle(0x3355aa, 1);
    g.fillRoundedRect(4, 20, 32, 40, 8);
    g.fillStyle(0xffd8a8, 1);
    g.fillCircle(20, 14, 14);
    g.generateTexture('defender_placeholder', 40, 62);

    // Avatar de portero/heroe: circulo con inicial, se sustituye luego por foto real
    g.clear();
    g.fillStyle(0xe0a458, 1);
    g.fillCircle(28, 28, 28);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(28, 28, 28);
    g.generateTexture('hero_placeholder', 56, 56);

    // Poste de porteria
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 6, 60);
    g.generateTexture('post', 6, 60);

    g.destroy();
  }
}

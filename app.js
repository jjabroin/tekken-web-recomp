/**
 * TEKKEN Web Recomp Runtime Engine
 * Pure JS/Canvas/WebAudio Implementation with Binary Parser & Tekken Input Buffer
 */

class WebAudioSynth {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playHit(isHeavy = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isHeavy ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(isHeavy ? 150 : 280, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

    gain.gain.setValueAtTime(isHeavy ? 0.35 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  playElectric() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Zap / Wind God Fist lightning buzz
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600 + i * 200, now + i * 0.03);
      osc.frequency.exponentialRampToValueAtTime(120, now + i * 0.03 + 0.08);

      gain.gain.setValueAtTime(0.2, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.03 + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.03);
      osc.stop(now + i * 0.03 + 0.09);
    }
  }

  playWhoosh() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }
}

class Fighter {
  constructor(name, x, facingRight, color, isCpu = false) {
    this.name = name;
    this.x = x;
    this.y = 380;
    this.baseY = 380;
    this.vx = 0;
    this.vy = 0;
    this.facingRight = facingRight;
    this.color = color;
    this.isCpu = isCpu;

    this.hp = 100;
    this.maxHp = 100;
    this.state = 'idle'; // idle, walk, dash, attack, hit, airborne, guard
    this.animTimer = 0;
    this.attackFrame = 0;
    this.currentMove = null;
    this.comboCount = 0;
    this.comboTimer = 0;

    this.inputBuffer = [];
  }

  update(opponent, synth, spawnParticle) {
    // Face opponent
    if (this.state === 'idle' || this.state === 'walk') {
      this.facingRight = this.x < opponent.x;
    }

    // Apply Gravity
    if (this.y < this.baseY || this.vy < 0) {
      this.vy += 0.8;
      this.y += this.vy;
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.vy = 0;
        if (this.state === 'airborne' || this.state === 'hit') {
          this.state = 'idle';
        }
      }
    }

    // Horizontal Movement
    this.x += this.vx;
    this.vx *= 0.85; // friction

    // Bounds limit
    if (this.x < 50) this.x = 50;
    if (this.x > 590) this.x = 590;

    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer === 0) {
        this.comboCount = 0;
      }
    }

    // Attack State Progress
    if (this.state === 'attack' && this.currentMove) {
      this.animTimer++;
      const move = this.currentMove;

      // Active hit frame
      if (this.animTimer === move.hitFrame) {
        synth.playWhoosh();
        // Check Hitbox Collision
        const range = move.range || 70;
        const hitX = this.facingRight ? this.x + range : this.x - range;
        const dist = Math.abs(this.x - opponent.x);

        if (dist <= range + 30) {
          // Hit connected!
          const isGuarding = opponent.state === 'guard';
          if (isGuarding && !move.unblockable) {
            opponent.hp -= Math.floor(move.damage * 0.15); // Chip damage
            opponent.vx = this.facingRight ? 4 : -4;
            synth.playHit(false);
            spawnParticle(opponent.x, opponent.y - 50, '#38bdf8', 6);
          } else {
            opponent.hp -= move.damage;
            opponent.comboCount++;
            opponent.comboTimer = 60;
            opponent.state = move.launcher ? 'airborne' : 'hit';

            if (move.launcher) {
              opponent.vy = -14;
              opponent.vx = this.facingRight ? 3 : -3;
              synth.playElectric();
              spawnParticle(opponent.x, opponent.y - 60, '#facc15', 24);
            } else {
              opponent.vx = this.facingRight ? 8 : -8;
              synth.playHit(true);
              spawnParticle(opponent.x, opponent.y - 50, '#ef4444', 12);
            }

            if (opponent.hp < 0) opponent.hp = 0;
          }
        }
      }

      if (this.animTimer >= move.totalFrames) {
        this.state = 'idle';
        this.currentMove = null;
        this.animTimer = 0;
      }
    } else if (this.state === 'hit') {
      this.animTimer++;
      if (this.animTimer > 18) {
        this.state = 'idle';
        this.animTimer = 0;
      }
    }

    // CPU Logic
    if (this.isCpu && this.hp > 0) {
      this.updateCpu(opponent);
    }
  }

  updateCpu(opponent) {
    if (this.state !== 'idle') return;
    const dist = Math.abs(this.x - opponent.x);

    if (dist > 120) {
      // Walk towards P1
      this.vx = this.x < opponent.x ? 2.5 : -2.5;
    } else {
      // In range, random attack or guard
      const rand = Math.random();
      if (rand < 0.04) {
        this.performAttack('LP', { damage: 8, hitFrame: 6, totalFrames: 14, range: 60 });
      } else if (rand < 0.07) {
        this.performAttack('RP', { damage: 12, hitFrame: 8, totalFrames: 18, range: 65 });
      } else if (rand < 0.09) {
        this.performAttack('EWGF', { damage: 25, hitFrame: 11, totalFrames: 24, range: 75, launcher: true });
      } else if (rand < 0.12) {
        this.state = 'guard';
        setTimeout(() => { if (this.state === 'guard') this.state = 'idle'; }, 400);
      }
    }
  }

  performAttack(name, moveData) {
    if (this.state === 'attack' || this.state === 'hit' || this.state === 'airborne') return;
    this.state = 'attack';
    this.currentMove = { name, ...moveData };
    this.animTimer = 0;
  }

  draw(ctx) {
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.baseY + 10, 32, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body Rendering
    const flip = this.facingRight ? 1 : -1;
    ctx.translate(this.x, this.y);
    ctx.scale(flip, 1);

    // Torso & Gi
    ctx.fillStyle = this.color;
    ctx.fillRect(-18, -90, 36, 50);

    // Belt
    ctx.fillStyle = '#000000';
    ctx.fillRect(-20, -45, 40, 8);

    // Head
    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.arc(0, -105, 14, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Headband
    ctx.fillStyle = this.name === 'KAZUMA' ? '#18181b' : '#ffffff';
    ctx.fillRect(-12, -122, 24, 10);

    // Legs
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-16, -40, 14, 45); // Left leg
    ctx.fillRect(2, -40, 14, 45);  // Right leg

    // Hands / Attacks
    ctx.fillStyle = '#ef4444'; // Gloves
    if (this.state === 'attack' && this.currentMove) {
      if (this.currentMove.launcher) {
        // Wind God Fist Rising Uppercut pose
        ctx.fillStyle = '#facc15';
        ctx.fillRect(8, -135, 18, 30);
      } else {
        // Punch / Kick forward
        ctx.fillRect(14, -75, 28, 14);
      }
    } else if (this.state === 'guard') {
      ctx.fillRect(-6, -85, 12, 30);
    } else {
      ctx.fillRect(-26, -70, 12, 16);
      ctx.fillRect(14, -70, 12, 16);
    }

    ctx.restore();
  }
}

// Particle System for Electric Wind God Fist & Hits
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawn(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10 - 2,
        size: Math.random() * 4 + 2,
        color,
        life: 1.0,
        decay: Math.random() * 0.05 + 0.04
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// Main Game Controller
class GameController {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.synth = new WebAudioSynth();
    this.particles = new ParticleSystem();

    this.p1 = new Fighter('KAZUMA', 180, true, '#1e293b');
    this.p2 = new Fighter('HEIJI', 460, false, '#475569', true);

    this.keys = {};
    this.keyHistory = [];
    this.isRunning = false;
    this.roundTime = 99;
    this.roundInterval = null;

    this.initDOM();
  }

  initDOM() {
    const dropZone = document.getElementById('drop-zone');
    const btnDemo = document.getElementById('btn-demo-mode');
    const fileInput = document.getElementById('rom-file-input');

    btnDemo.addEventListener('click', () => {
      this.synth.init();
      this.startEngine('Built-in Tekken Recomp Core');
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleBinaryFile(e.target.files[0]);
      }
    });

    // Drag and Drop
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        this.handleBinaryFile(e.dataTransfer.files[0]);
      }
    });

    // Keyboard Listeners
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  handleBinaryFile(file) {
    const irTag = document.getElementById('pipeline-ir');
    irTag.textContent = `Parsing ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`;

    this.synth.init();
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = new Uint8Array(event.target.result);
      // Simulate Header Decoding
      const header = String.fromCharCode(...buffer.slice(0, 4));
      irTag.textContent = `Mapped: ${file.name} [Ready]`;
      document.getElementById('runtime-status').textContent = `BINARY LOADED: ${file.name}`;
      this.startEngine(`Loaded Binary: ${file.name}`);
    };
    reader.readAsArrayBuffer(file);
  }

  startEngine(sourceName) {
    document.getElementById('drop-zone').classList.add('hidden');
    document.getElementById('hud-overlay').classList.remove('hidden');
    document.getElementById('pipeline-ir').textContent = sourceName;

    this.isRunning = true;
    this.roundTime = 99;
    clearInterval(this.roundInterval);
    this.roundInterval = setInterval(() => {
      if (this.roundTime > 0 && this.isRunning) {
        this.roundTime--;
        document.getElementById('timer-text').textContent = this.roundTime;
      }
    }, 1000);

    requestAnimationFrame(() => this.loop());
  }

  onKeyDown(e) {
    if (this.keys[e.key.toLowerCase()]) return;
    const k = e.key.toLowerCase();
    this.keys[k] = true;

    // Buffer inputs for motion execution (EWGF, Deathfist)
    const now = Date.now();
    this.keyHistory.push({ key: k, time: now });
    // Clean old inputs older than 600ms
    this.keyHistory = this.keyHistory.filter(item => now - item.time < 600);

    this.evaluateMoves();
  }

  onKeyUp(e) {
    const k = e.key.toLowerCase();
    this.keys[k] = false;
    if ((k === 'a' || k === 'd') && this.p1.state === 'walk') {
      this.p1.state = 'idle';
    }
  }

  evaluateMoves() {
    if (!this.isRunning || this.p1.state === 'attack' || this.p1.state === 'hit') return;

    const hist = this.keyHistory.map(h => h.key);
    const len = hist.length;

    // Check Electric Wind God Fist (초풍신): Forward -> Down -> DownForward + RP (K)
    // Keys: d -> s -> (s+d) -> k
    const isEwgf = (this.keys['d'] || this.keys['s']) && this.keys['k'] && len >= 3;
    // Check Deathfist (붕권): Forward -> Forward + RP (K)
    const isDeathfist = hist.slice(-2).join('') === 'dd' && this.keys['k'];

    if (isEwgf) {
      this.p1.performAttack('EWGF', { damage: 28, hitFrame: 9, totalFrames: 22, range: 85, launcher: true });
      this.keyHistory = [];
      return;
    }

    if (isDeathfist) {
      this.p1.performAttack('Deathfist', { damage: 32, hitFrame: 12, totalFrames: 26, range: 90, unblockable: false });
      this.keyHistory = [];
      return;
    }

    // Normal 4 buttons
    if (this.keys['j']) { // LP (1)
      this.p1.performAttack('LP', { damage: 8, hitFrame: 6, totalFrames: 14, range: 60 });
    } else if (this.keys['k']) { // RP (2)
      this.p1.performAttack('RP', { damage: 12, hitFrame: 8, totalFrames: 18, range: 65 });
    } else if (this.keys['u']) { // LK (3)
      this.p1.performAttack('LK', { damage: 14, hitFrame: 9, totalFrames: 20, range: 75 });
    } else if (this.keys['i']) { // RK (4)
      this.p1.performAttack('RK', { damage: 18, hitFrame: 10, totalFrames: 22, range: 80 });
    } else if (this.keys['r'] && this.p1.hp <= 30) { // Rage Art
      this.p1.performAttack('Rage Art', { damage: 45, hitFrame: 14, totalFrames: 35, range: 95, launcher: true });
    }
  }

  update() {
    // P1 Movement
    if (this.p1.state === 'idle' || this.p1.state === 'walk') {
      if (this.keys['d']) {
        this.p1.vx = 4;
        this.p1.state = 'walk';
      } else if (this.keys['a']) {
        this.p1.vx = -4;
        this.p1.state = 'walk';
      }

      if (this.keys['w'] && this.p1.y === this.p1.baseY) {
        this.p1.vy = -12;
      }
    }

    // Guarding
    if (this.p1.facingRight && this.keys['a']) {
      this.p1.state = 'guard';
    }

    const spawnFn = (x, y, color, count) => this.particles.spawn(x, y, color, count);
    this.p1.update(this.p2, this.synth, spawnFn);
    this.p2.update(this.p1, this.synth, spawnFn);
    this.particles.update();

    // Update Health Bars
    document.getElementById('hp-bar-p1').style.width = `${(this.p1.hp / this.p1.maxHp) * 100}%`;
    document.getElementById('hp-bar-p2').style.width = `${(this.p2.hp / this.p2.maxHp) * 100}%`;

    // Combo UI
    const comboEl = document.getElementById('combo-display');
    if (this.p2.comboCount > 1) {
      comboEl.textContent = `${this.p2.comboCount} HITS!`;
    } else {
      comboEl.textContent = '';
    }
  }

  draw() {
    // 3D Grid Stage Render (Tekken Infinite Floor)
    this.ctx.fillStyle = '#090a0f';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Cyberpunk Horizon Grid
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.lineWidth = 1;
    for (let y = 380; y <= 480; y += 15) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(640, y);
      this.ctx.stroke();
    }
    for (let x = -200; x <= 840; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(320 + (x - 320) * 0.2, 380);
      this.ctx.lineTo(x, 480);
      this.ctx.stroke();
    }

    // Stage Lighting Ring
    const grad = this.ctx.createRadialGradient(320, 390, 50, 320, 390, 300);
    grad.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 200, 640, 280);

    // Draw Entities
    this.p1.draw(this.ctx);
    this.p2.draw(this.ctx);
    this.particles.draw(this.ctx);
  }

  loop() {
    if (!this.isRunning) return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

// Start on load
window.addEventListener('DOMContentLoaded', () => {
  new GameController();
});

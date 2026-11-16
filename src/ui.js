/** UI — Minimal HUD and pause menu. */

export class HUD {
  constructor(elementId) {
    this.element = document.getElementById(elementId);
  }

  updateStats({ fps, timeScale, entityCount, timeString, dateString, weather }) {
    if (!this.element) return;
    this.element.innerHTML = `
      FPS: ${Math.round(fps)}<br>
      ${dateString} ${timeString}<br>
      Time Scale: ${timeScale}x<br>
      ${weather}<br>
      Entities: ${entityCount}<br>
      <br>
      Click: raise/lower terrain
      Shift+Click: carve cave/tunnel
      Ctrl+Click: lower terrain
      Mouse over entity: see info
      +/-: time speed
      0: real-time
    `;
  }
}

export class Menu {
  constructor(elementId, onStart) {
    this.element = document.getElementById(elementId);
    this.startBtn = document.getElementById('start-btn');
    this.onStart = onStart;
    this.visible = true;
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => {
        this.hide();
        if (this.onStart) this.onStart();
      });
    }
  }

  show() {
    if (this.element) this.element.style.display = 'block';
    this.visible = true;
  }

  hide() {
    if (this.element) this.element.style.display = 'none';
    this.visible = false;
  }
}
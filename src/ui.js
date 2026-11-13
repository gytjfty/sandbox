/**
 * UI — Minimal HUD and pause menu.
 */

export class HUD {
  constructor(elementId) {
    this.element = document.getElementById(elementId);
  }

  updateStats({ fps, simTime, timeScale, entityCount }) {
    if (!this.element) return;
    this.element.innerHTML = `
      FPS: ${Math.round(fps)}<br>
      Sim Time: ${simTime.toFixed(1)}s<br>
      Time Scale: ${timeScale}x<br>
      Entities: ${entityCount}
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
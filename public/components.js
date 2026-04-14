// Roots Record — Light DOM Web Components (no Shadow DOM)

// ── <confirm-dialog> ──────────────────────────────────────────────────────
class ConfirmDialogElement extends HTMLElement {
  connectedCallback() {
    if (this._ready) return;
    this._ready = true;

    this.insertAdjacentHTML('beforeend', `
      <dialog id="confirm-dialog">
        <div class="confirm-dialog-inner">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"
               class="confirm-icon" aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p class="confirm-message">Are you sure?</p>
          <div class="confirm-actions">
            <button class="outline">Cancel</button>
            <button class="danger">Confirm</button>
          </div>
        </div>
      </dialog>
    `);

    this._dialog  = this.querySelector('dialog');
    this._message = this.querySelector('.confirm-message');
    this._cancel  = this.querySelector('button.outline');
    this._ok      = this.querySelector('button.danger');

    this._cancel.addEventListener('click', () => this._dialog.close());
    this._dialog.addEventListener('click', e => { if (e.target === this._dialog) this._dialog.close(); });
  }

  show(message, onConfirm) {
    this._message.textContent = message;
    // Swap node to clear old listeners
    const fresh = this._ok.cloneNode(true);
    this._ok.replaceWith(fresh);
    this._ok = fresh;
    this._ok.addEventListener('click', () => { this._dialog.close(); onConfirm(); });
    this._dialog.showModal();
  }
}
customElements.define('confirm-dialog', ConfirmDialogElement);


// ── <qr-modal> ────────────────────────────────────────────────────────────
class QrModalElement extends HTMLElement {
  connectedCallback() {
    if (this._ready) return;
    this._ready = true;

    this.insertAdjacentHTML('beforeend', `
      <dialog id="qr-dialog">
        <div class="qr-dialog-inner">
          <p class="qr-url" id="qr-url-text"></p>
          <div id="qr-img"></div>
          <button class="outline">Close</button>
        </div>
      </dialog>
    `);

    this._dialog  = this.querySelector('dialog');
    this._urlText = this.querySelector('#qr-url-text');
    this._img     = this.querySelector('#qr-img');

    this.querySelector('button.outline').addEventListener('click', () => this._dialog.close());
    this._dialog.addEventListener('click', e => { if (e.target === this._dialog) this._dialog.close(); });
  }

  show() {
    const url = location.origin;
    this._urlText.textContent = url;
    this._img.innerHTML = '';
    new QRCode(this._img, { text: url, width: 220, height: 220 });
    this._dialog.showModal();
  }
}
customElements.define('qr-modal', QrModalElement);


// ── <theme-picker> ────────────────────────────────────────────────────────
const THEMES = [
  { id: 'forest', color: '#166534', label: 'Forest' },
  { id: 'ocean',  color: '#1D4ED8', label: 'Ocean'  },
  { id: 'ember',  color: '#B45309', label: 'Ember'  },
  { id: 'plum',   color: '#6D28D9', label: 'Plum'   },
  { id: 'teal',   color: '#0F766E', label: 'Teal'   },
];

class ThemePickerElement extends HTMLElement {
  connectedCallback() {
    if (this._ready) return;
    this._ready = true;

    this.insertAdjacentHTML('beforeend', `
      <div class="theme-wrap">
        <button class="theme-btn" aria-label="Choose color theme" title="Choose theme"></button>
        <div class="theme-picker">
          ${THEMES.map(t => `
            <button class="theme-swatch" data-theme="${t.id}"
                    style="--sw:${t.color}" title="${t.label}"></button>
          `).join('')}
        </div>
      </div>
    `);

    this._btn    = this.querySelector('.theme-btn');
    this._picker = this.querySelector('.theme-picker');

    this._btn.addEventListener('click', e => {
      e.stopPropagation();
      this._picker.classList.toggle('is-open');
    });

    this.querySelectorAll('.theme-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        this._apply(swatch.dataset.theme);
        this._picker.classList.remove('is-open');
      });
    });

    document.addEventListener('click', () => this._picker.classList.remove('is-open'));

    this._apply(localStorage.getItem('rr-theme') || 'forest');
  }

  _apply(name) {
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem('rr-theme', name);
    this.querySelectorAll('.theme-swatch').forEach(s => {
      s.classList.toggle('is-active', s.dataset.theme === name);
    });
  }
}
customElements.define('theme-picker', ThemePickerElement);

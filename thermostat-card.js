// ═══════════════════════════════════════════════════════════════
//  Thermostat Card — visuele editor
// ═══════════════════════════════════════════════════════════════

class ThermostatCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    if (!this._hass) return;

    const currentAction = this._config.tap_action?.action ?? 'more-info';
    const navPath       = this._config.tap_action?.navigation_path ?? '';

    this.shadowRoot.innerHTML = `
      <style>
        .form      { display:flex; flex-direction:column; gap:16px; padding:8px 0; }
        .nav-field { display: ${currentAction === 'navigate' ? 'block' : 'none'}; }
        label      { font-size:12px; color:var(--secondary-text-color);
                     margin-bottom:2px; display:block; }
      </style>
      <div class="form">
        <div>
          <label>Thermostaat entiteit *</label>
          <ha-entity-picker id="entity-picker" label="Selecteer klimaatentiteit"
            allow-custom-entity></ha-entity-picker>
        </div>
        <div>
          <label>Actie bij tikken op temperatuur</label>
          <ha-select id="action-type" label="Actie" style="width:100%">
            <mwc-list-item value="more-info">Meer informatie (standaard)</mwc-list-item>
            <mwc-list-item value="navigate">Navigeren naar pagina</mwc-list-item>
            <mwc-list-item value="none">Geen actie</mwc-list-item>
          </ha-select>
        </div>
        <div class="nav-field">
          <label>Navigatiepad</label>
          <ha-textfield id="nav-path" label="bijv. /lovelace/thermostaat"
            style="width:100%"></ha-textfield>
        </div>
      </div>
    `;

    // ── Entity picker ────────────────────────────────────────
    const picker = this.shadowRoot.getElementById('entity-picker');
    picker.hass           = this._hass;
    picker.value          = this._config.entity || '';
    picker.includeDomains = ['climate'];
    picker.addEventListener('value-changed', (e) => {
      if (!e.detail.value) return;
      this._config = { ...this._config, entity: e.detail.value };
      this._fire();
    });

    // ── Actie dropdown ───────────────────────────────────────
    const actionSelect = this.shadowRoot.getElementById('action-type');
    actionSelect.value = currentAction;
    actionSelect.addEventListener('selected', (e) => {
      const val = e.detail?.item?.value ?? currentAction;
      const navField = this.shadowRoot.querySelector('.nav-field');
      if (navField) navField.style.display = val === 'navigate' ? 'block' : 'none';

      this._config = {
        ...this._config,
        tap_action: val === 'none'     ? { action: 'none' }
                  : val === 'navigate' ? { action: 'navigate',
                      navigation_path: this._config.tap_action?.navigation_path ?? '' }
                  : { action: 'more-info' },
      };
      this._fire();
    });

    // ── Navigatiepad ─────────────────────────────────────────
    const navField = this.shadowRoot.getElementById('nav-path');
    navField.value = navPath;
    navField.addEventListener('change', (e) => {
      this._config = {
        ...this._config,
        tap_action: { action: 'navigate', navigation_path: e.target.value.trim() },
      };
      this._fire();
    });
  }

  _fire() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('thermostat-card-editor', ThermostatCardEditor);


// ═══════════════════════════════════════════════════════════════
//  Thermostat Card — de kaart zelf
// ═══════════════════════════════════════════════════════════════

class ThermostatCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._showSetpoint = false;
    this._timer        = null;
    this._hass         = null;
    this._config       = null;
    this._domReady     = false;
  }

  // ── HA-methodes ─────────────────────────────────────────────

  static getConfigElement() {
    return document.createElement('thermostat-card-editor');
  }

  static getStubConfig() {
    return {
      entity    : 'climate.woonkamer',
      tap_action: { action: 'more-info' },
    };
  }

  setConfig(config) {
    if (!config.entity) throw new Error('Definieer een entity (climate.*)');
    this._config   = config;
    this._domReady = false;   // forceer volledige rebuild bij config-wijziging
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  // ── Interne helpers ──────────────────────────────────────────

  get _stateObj() {
    return this._hass?.states[this._config?.entity];
  }

  _adjustTemp(delta) {
    const s = this._stateObj;
    if (!s) return;

    const cur  = parseFloat(s.attributes.temperature      ?? 20);
    const step = parseFloat(s.attributes.target_temp_step ?? 0.5);
    const minT = parseFloat(s.attributes.min_temp         ?? 5);
    const maxT = parseFloat(s.attributes.max_temp         ?? 35);
    const next = parseFloat(
      Math.min(maxT, Math.max(minT, cur + delta * step)).toFixed(1)
    );

    this._hass.callService('climate', 'set_temperature', {
      entity_id : this._config.entity,
      temperature: next,
    });

    // Toon instelpunt 5 seconden; verdere drukken verlengen de timer
    this._showSetpoint = true;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._showSetpoint = false;
      this._timer = null;
      this._update();
    }, 5000);

    this._update();
  }

  _handleCenterTap() {
    const action = this._config.tap_action?.action ?? 'more-info';

    if (action === 'more-info') {
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        bubbles : true,
        composed: true,
        detail  : { entityId: this._config.entity },
      }));
    } else if (action === 'navigate') {
      const path = this._config.tap_action?.navigation_path;
      if (path) {
        history.pushState(null, '', path);
        window.dispatchEvent(
          new CustomEvent('location-changed', { detail: { replace: false } })
        );
      }
    }
    // action === 'none' → niets doen
  }

  _getBubbleColor(s) {
    if (this._showSetpoint) return 'rgba(255,255,255,0.60)';
    const hvac = s?.attributes?.hvac_action || s?.state;
    if (hvac === 'heating') return 'rgba(244, 67, 54, 0.25)';
    if (hvac === 'cooling') return 'rgba( 33,150,243, 0.25)';
    if (hvac === 'off')     return 'rgba(102,102,102, 0.25)';
    return                         'rgba(136,136,136, 0.25)';
  }

  // ── DOM opbouw (één keer) ────────────────────────────────────

  _buildDOM() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        .container {
          display        : flex;
          align-items    : center;
          justify-content: center;
          padding        : 4px 0;
          gap            : 2px;
        }

        .adj-btn {
          background     : none;
          border         : none;
          color          : white;
          cursor         : pointer;
          width          : 70px;
          height         : 60px;
          display        : flex;
          align-items    : center;
          justify-content: center;
          border-radius  : 12px;
          transition     : opacity .15s, transform .15s;
          -webkit-tap-highlight-color: transparent;
        }
        .adj-btn:active {
          opacity  : 0.5;
          transform: scale(0.88);
        }

        .bubble {
          width          : 65px;
          height         : 60px;
          border-radius  : 30%;
          display        : flex;
          flex-direction : column;
          align-items    : center;
          justify-content: center;
          transition     : background-color 0.4s ease;
          user-select    : none;
          -webkit-tap-highlight-color: transparent;
        }
        .bubble[data-clickable="true"] { cursor: pointer; }
        .bubble:active                 { opacity: 0.75; }

        .temp-value {
          font-size  : 24px;
          font-weight: 500;
          color      : white;
          line-height: 1;
        }

        .indicator {
          font-size     : 10px;
          color         : rgba(255,255,255,0.80);
          margin-top    : 3px;
          letter-spacing: 0.02em;
          min-height    : 14px;
        }
      </style>

      <div class="container">
        <button class="adj-btn" data-action="minus" aria-label="Verlaag temperatuur">
          <ha-icon icon="mdi:minus"></ha-icon>
        </button>

        <div class="bubble" data-action="center" role="button"
             aria-label="Temperatuur">
          <span class="temp-value" id="temp-display">—</span>
          <span class="indicator"  id="indicator"></span>
        </div>

        <button class="adj-btn" data-action="plus" aria-label="Verhoog temperatuur">
          <ha-icon icon="mdi:plus"></ha-icon>
        </button>
      </div>
    `;

    // ── Event delegation: één listener, blijft altijd actief ──
    this.shadowRoot.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      switch (el.dataset.action) {
        case 'minus' : this._adjustTemp(-1);       break;
        case 'plus'  : this._adjustTemp(1);        break;
        case 'center': this._handleCenterTap();    break;
      }
    });

    this._domReady = true;
  }

  // ── Update (alleen wijzigende delen) ─────────────────────────

  _update() {
    const s = this._stateObj;
    if (!s) return;

    const currentTemp = s.attributes.current_temperature ?? '—';
    const setpoint    = s.attributes.temperature         ?? '—';
    const displayTemp = this._showSetpoint ? setpoint : currentTemp;

    const tempEl      = this.shadowRoot.getElementById('temp-display');
    const indicatorEl = this.shadowRoot.getElementById('indicator');
    const bubble      = this.shadowRoot.querySelector('.bubble');

    if (tempEl)      tempEl.textContent = displayTemp;
    if (indicatorEl) indicatorEl.textContent = this._showSetpoint ? 'instelpunt' : '';
    if (bubble) {
      bubble.style.backgroundColor = this._getBubbleColor(s);

      // Klikbaarheid tonen
      const action = this._config?.tap_action?.action ?? 'more-info';
      bubble.dataset.clickable = action !== 'none' ? 'true' : 'false';
      bubble.setAttribute('aria-label',
        `Huidige temp: ${currentTemp}°, instelpunt: ${setpoint}°`);
    }
  }

  // ── Hoofd render ─────────────────────────────────────────────

  _render() {
    if (!this._hass || !this._config) return;

    const s = this._stateObj;
    if (!s) {
      this.shadowRoot.innerHTML = `
        <style>:host{display:block}</style>
        <div style="color:var(--error-color,red);padding:8px;font-size:14px">
          Entity niet gevonden: <b>${this._config.entity}</b>
        </div>`;
      this._domReady = false;
      return;
    }

    // DOM één keer bouwen; daarna alleen updaten
    if (!this._domReady) this._buildDOM();
    this._update();
  }
}

// ── Registratie ─────────────────────────────────────────────────

customElements.define('thermostat-card', ThermostatCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type       : 'thermostat-card',
  name       : 'Thermostat Card',
  description: 'Thermostaatkaart — huidige temperatuur, 5 sec instelpunt na aanpassing',
  preview    : false,
});

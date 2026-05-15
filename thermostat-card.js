class ThermostatCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._showSetpoint = false;
    this._timer        = null;
    this._hass         = null;
    this._config       = null;
  }

  // ── Verplichte HA-methodes ──────────────────────────────────

  setConfig(config) {
    if (!config.entity) throw new Error('Definieer een entity (climate.*)');
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  static getConfigElement() {
    // optioneel: visuele editor — voorlopig niet geïmplementeerd
    return null;
  }

  static getStubConfig() {
    return { entity: 'climate.woonkamer' };
  }

  // ── Interne helpers ─────────────────────────────────────────

  get _stateObj() {
    return this._hass?.states[this._config?.entity];
  }

  _adjustTemp(delta) {
    const s = this._stateObj;
    if (!s) return;

    const cur  = parseFloat(s.attributes.temperature          ?? 20);
    const step = parseFloat(s.attributes.target_temp_step     ?? 0.5);
    const minT = parseFloat(s.attributes.min_temp             ?? 5);
    const maxT = parseFloat(s.attributes.max_temp             ?? 35);
    const next = parseFloat(
      Math.min(maxT, Math.max(minT, cur + delta * step)).toFixed(1)
    );

    this._hass.callService('climate', 'set_temperature', {
      entity_id: this._config.entity,
      temperature: next,
    });

    // Toon instelpunt voor 5 seconden
    this._showSetpoint = true;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._showSetpoint = false;
      this._render();
    }, 5000);

    this._render();
  }

  _handleCenterTap() {
    const action = this._config.tap_action;
    if (!action) return;

    if (action.action === 'navigate' && action.navigation_path) {
      history.pushState(null, '', action.navigation_path);
      window.dispatchEvent(
        new CustomEvent('location-changed', { detail: { replace: false } })
      );
    } else if (action.action === 'more-info') {
      this.dispatchEvent(
        new CustomEvent('hass-more-info', {
          bubbles: true,
          composed: true,
          detail: { entityId: this._config.entity },
        })
      );
    }
  }

  // ── Render ──────────────────────────────────────────────────

  _render() {
    if (!this._hass || !this._config) return;

    const s = this._stateObj;
    if (!s) {
      this.shadowRoot.innerHTML = `
        <style>:host{display:block}</style>
        <div style="color:red;padding:8px">
          Entity niet gevonden: ${this._config.entity}
        </div>`;
      return;
    }

    const hvac        = s.attributes.hvac_action || s.state;
    const currentTemp = s.attributes.current_temperature ?? '—';
    const setpoint    = s.attributes.temperature          ?? '—';
    const displayTemp = this._showSetpoint ? setpoint : currentTemp;

    // Kleur van de middelste bubbel
    let bubbleBg;
    if (this._showSetpoint) {
      bubbleBg = 'rgba(255,255,255,0.60)';
    } else if (hvac === 'heating') {
      bubbleBg = 'rgba(244, 67, 54, 0.25)';
    } else if (hvac === 'cooling') {
      bubbleBg = 'rgba( 33,150,243, 0.25)';
    } else if (hvac === 'off') {
      bubbleBg = 'rgba(102,102,102, 0.25)';
    } else {
      bubbleBg = 'rgba(136,136,136, 0.25)';
    }

    const indicatorHTML = this._showSetpoint
      ? `<span class="indicator">instelpunt</span>`
      : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        .container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px 0;
          gap: 2px;
        }

        .adj-btn {
          background : none;
          border     : none;
          color      : white;
          cursor     : pointer;
          width      : 70px;
          height     : 60px;
          display    : flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          transition : opacity .15s, transform .15s;
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
          background-color: ${bubbleBg};
          display        : flex;
          flex-direction : column;
          align-items    : center;
          justify-content: center;
          cursor         : pointer;
          transition     : background-color 0.4s ease;
          user-select    : none;
          -webkit-tap-highlight-color: transparent;
        }
        .bubble:active { opacity: 0.75; }

        .temp-value {
          font-size  : 24px;
          font-weight: 500;
          color      : white;
          line-height: 1;
        }

        .indicator {
          font-size : 10px;
          color     : rgba(255,255,255,0.80);
          margin-top: 3px;
          letter-spacing: 0.02em;
        }
      </style>

      <div class="container">
        <button class="adj-btn" id="btn-min" aria-label="Verlaag temperatuur">
          <ha-icon icon="mdi:minus"></ha-icon>
        </button>

        <div class="bubble" id="btn-center" role="button"
             aria-label="Huidige temperatuur: ${currentTemp}, instelpunt: ${setpoint}">
          <span class="temp-value">${displayTemp}</span>
          ${indicatorHTML}
        </div>

        <button class="adj-btn" id="btn-plus" aria-label="Verhoog temperatuur">
          <ha-icon icon="mdi:plus"></ha-icon>
        </button>
      </div>
    `;

    this.shadowRoot
      .getElementById('btn-min')
      .addEventListener('click', () => this._adjustTemp(-1));

    this.shadowRoot
      .getElementById('btn-plus')
      .addEventListener('click', () => this._adjustTemp(1));

    this.shadowRoot
      .getElementById('btn-center')
      .addEventListener('click', () => this._handleCenterTap());
  }
}

// ── Registratie ────────────────────────────────────────────────

customElements.define('thermostat-card', ThermostatCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type       : 'thermostat-card',
  name       : 'Thermostat Card',
  description: 'Thermostaatkaart — toont huidige temperatuur, 5 sec instelpunt na aanpassing',
  preview    : false,
});

/**
 * main.js — Pathfinder Movement Plugin para Owlbear Rodeo 2.x
 *
 * Módulos:
 *   - OBRBridge        : integração com a API do OBR
 *   - TokenRegistry    : gerenciamento de tokens registrados
 *   - PathEngine       : execução de caminhos com animação
 *   - AIEngine         : IA autônoma (wander / patrol / chase / flee)
 *   - UIController     : ligações entre UI e lógica
 */

// ═══════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════

const METADATA_KEY  = "br.owlbear.pathfinder-movement/data";
const TRAIL_LAYER   = "ATTACHMENT";   // layer para linhas de caminho
const DEFAULT_GRID  = 75;             // pixels por quadrado (fallback)

// ═══════════════════════════════════════════════════════
//  OBR BRIDGE — abstrai chamadas à API do Owlbear Rodeo
// ═══════════════════════════════════════════════════════

const OBRBridge = {
  ready: false,
  gridSize: DEFAULT_GRID,

  async init() {
    try {
      await OBR.onReady(async () => {
        this.ready = true;
        const grid = await OBR.scene.grid.getDpi();
        if (grid) this.gridSize = grid;
        document.getElementById("obr-status").textContent = "● OBR OK";
        document.getElementById("obr-status").style.color = "#2ecc71";
        document.getElementById("cfg-grid-size").value = this.gridSize;
        UIController.init();
        TokenRegistry.loadFromMetadata();
        OBRBridge._setupListeners();
      });
    } catch(e) {
      console.warn("OBR não disponível — modo demo.", e);
      this.ready = false;
      document.getElementById("obr-status").textContent = "⚠ demo";
      document.getElementById("obr-status").style.color = "#f39c12";
      UIController.init();
    }
  },

  _setupListeners() {
    // Escuta mudanças de cena para atualizar grid
    OBR.scene.grid.onChange(grid => {
      if (grid?.dpi) {
        this.gridSize = grid.dpi;
        document.getElementById("cfg-grid-size").value = this.gridSize;
      }
    });

    // Escuta cliques no mapa quando o modo "clique" está ativo
    OBR.player.onChange(() => {});
  },

  async getTokenPosition(tokenId) {
    if (!this.ready) return null;
    try {
      const items = await OBR.scene.items.getItems([tokenId]);
      if (items && items[0]) {
        return { x: items[0].position.x, y: items[0].position.y };
      }
    } catch(e) { console.error("getTokenPosition:", e); }
    return null;
  },

  async setTokenPosition(tokenId, x, y) {
    if (!this.ready) return;
    try {
      await OBR.scene.items.updateItems([tokenId], items => {
        for (const item of items) {
          item.position = { x, y };
        }
      });
    } catch(e) { console.error("setTokenPosition:", e); }
  },

  async getAllTokens() {
    if (!this.ready) return [];
    try {
      const items = await OBR.scene.items.getItems(
        item => item.layer === "CHARACTER" || item.layer === "MOUNT"
      );
      return items || [];
    } catch(e) { return []; }
  },

  async getSelectedTokens() {
    if (!this.ready) return [];
    try {
      return await OBR.player.getSelection() || [];
    } catch(e) { return []; }
  },

  /** Desenha a linha de caminho como shape no mapa */
  async drawPathLine(points, color, lineWidth, trailId) {
    if (!this.ready || points.length < 2) return;
    try {
      const id = trailId || `pf-trail-${Date.now()}`;
      // Remove linha antiga se existir
      await this.removeShape(id);

      const pathData = points.map((p, i) =>
        i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
      ).join(" ");

      await OBR.scene.items.addItems([{
        id,
        type: "PATH",
        layer: TRAIL_LAYER,
        visible: true,
        locked: true,
        commands: buildPathCommands(points),
        style: {
          fillColor:    "transparent",
          fillOpacity:  0,
          strokeColor:  color || "#c9a84c",
          strokeOpacity: 0.8,
          strokeWidth:  lineWidth || 3,
          strokeDash:   [8, 6],
        },
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        metadata: { [METADATA_KEY]: { type: "trail", trailId: id } },
      }]);
      return id;
    } catch(e) { console.error("drawPathLine:", e); }
  },

  async removeShape(id) {
    if (!this.ready) return;
    try {
      const items = await OBR.scene.items.getItems([id]);
      if (items && items.length > 0) {
        await OBR.scene.items.deleteItems([id]);
      }
    } catch(e) {}
  },

  async saveMetadata(data) {
    if (!this.ready) return;
    try {
      await OBR.scene.setMetadata({ [METADATA_KEY]: data });
    } catch(e) {}
  },

  async loadMetadata() {
    if (!this.ready) return null;
    try {
      const meta = await OBR.scene.getMetadata();
      return meta?.[METADATA_KEY] || null;
    } catch(e) { return null; }
  },

  /** Mostra notificação no OBR */
  notify(msg, type = "INFO") {
    if (!this.ready) return;
    try {
      OBR.notification.show(msg, type); // INFO | WARNING | ERROR | SUCCESS
    } catch(e) {}
  },

  /** Escuta cliques de posição no mapa (para modo clique) */
  onMapClick(callback) {
    if (!this.ready) return;
    try {
      OBR.tool.createTool({
        id: "pf-click-tool",
        shortcut: "W",
        icons: [{ icon: "/icon.svg", label: "Adicionar Waypoint", filter: { activeTools: ["pf-click-tool"] } }],
        onClick(ctx) {
          callback({ x: ctx.position.x, y: ctx.position.y });
        },
      });
    } catch(e) { console.error("onMapClick:", e); }
  },
};

function buildPathCommands(points) {
  return points.map((p, i) => ({
    type: i === 0 ? "M" : "L",
    position: { x: p.x, y: p.y },
  }));
}

// ═══════════════════════════════════════════════════════
//  TOKEN REGISTRY
// ═══════════════════════════════════════════════════════

const TokenRegistry = {
  tokens: [],   // [{ id, name, type, subtype, speed, color }]
  _selectedId: null,

  get selected() { return this.tokens.find(t => t.id === this._selectedId) || null; },

  add(token) {
    // token: { id, name, type, subtype, speed, color }
    if (this.tokens.find(t => t.id === token.id)) {
      UIController.setStatus(`Token "${token.name}" já registrado.`, "warning");
      return false;
    }
    this.tokens.push({ ...token });
    this._save();
    UIController.renderTokenList();
    return true;
  },

  remove(id) {
    this.tokens = this.tokens.filter(t => t.id !== id);
    if (this._selectedId === id) this._selectedId = null;
    this._save();
    UIController.renderTokenList();
    UIController.syncMovementPanel();
    UIController.syncAIPanel();
  },

  select(id) {
    this._selectedId = id;
    UIController.renderTokenList();
    UIController.syncMovementPanel();
    UIController.syncAIPanel();
  },

  _save() {
    const data = { tokens: this.tokens };
    localStorage.setItem("pf-tokens", JSON.stringify(data));
    OBRBridge.saveMetadata(data);
  },

  loadFromMetadata() {
    // Tenta localStorage primeiro (mais rápido)
    const local = localStorage.getItem("pf-tokens");
    if (local) {
      try {
        const data = JSON.parse(local);
        if (data.tokens) {
          this.tokens = data.tokens;
          UIController.renderTokenList();
          return;
        }
      } catch(e) {}
    }
    // Tenta metadata do OBR
    OBRBridge.loadMetadata().then(data => {
      if (data?.tokens) {
        this.tokens = data.tokens;
        UIController.renderTokenList();
      }
    });
  },

  exportJSON() {
    return JSON.stringify({ tokens: this.tokens }, null, 2);
  },

  importJSON(json) {
    try {
      const data = JSON.parse(json);
      if (data.tokens && Array.isArray(data.tokens)) {
        this.tokens = data.tokens;
        this._save();
        UIController.renderTokenList();
        return true;
      }
    } catch(e) {}
    return false;
  },
};

// ═══════════════════════════════════════════════════════
//  PATH ENGINE — animação de movimento
// ═══════════════════════════════════════════════════════

const PathEngine = {
  waypoints: [],     // [{ x, y }]
  running: false,
  loop: false,
  showTrail: true,
  lineWidth: 3,
  _animFrame: null,
  _trailId: null,
  _currentSegment: 0,
  _progress: 0,    // 0..1 no segmento atual
  _lastTime: null,

  get animSpeedSqPerSec() {
    return parseFloat(document.getElementById("anim-speed")?.value || 3);
  },

  addWaypoint(x, y) {
    this.waypoints.push({ x: parseFloat(x), y: parseFloat(y) });
    UIController.renderWaypoints();
    if (this.showTrail) this._redrawTrail();
  },

  removeWaypoint(index) {
    this.waypoints.splice(index, 1);
    UIController.renderWaypoints();
    if (this.showTrail) this._redrawTrail();
  },

  clearWaypoints() {
    this.waypoints = [];
    UIController.renderWaypoints();
    this._clearTrail();
  },

  async start() {
    const token = TokenRegistry.selected;
    if (!token) {
      UIController.setStatus("Selecione um token primeiro.", "error"); return;
    }
    if (this.waypoints.length < 1) {
      UIController.setStatus("Adicione ao menos 1 waypoint.", "error"); return;
    }
    if (this.running) return;

    // Pega posição atual do token como ponto de partida
    let startPos = await OBRBridge.getTokenPosition(token.id);
    if (!startPos) startPos = { x: 0, y: 0 };

    const fullPath = [startPos, ...this.waypoints];
    this.running = true;
    this._currentSegment = 0;
    this._progress = 0;
    this._lastTime = null;

    UIController.setStatus(`Movendo ${token.name}…`, "info");
    UIController.markTokenActive(token.id, true);

    if (this.showTrail) await this._redrawTrail(fullPath);

    this._animFrame = requestAnimationFrame(ts => this._tick(ts, fullPath, token));
  },

  stop() {
    this.running = false;
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this._animFrame = null;
    UIController.setStatus("Movimento pausado.", "warning");
    const token = TokenRegistry.selected;
    if (token) UIController.markTokenActive(token.id, false);
  },

  _tick(timestamp, path, token) {
    if (!this.running) return;

    if (this._lastTime === null) this._lastTime = timestamp;
    const dt = (timestamp - this._lastTime) / 1000;
    this._lastTime = timestamp;

    const gridSize = parseInt(document.getElementById("cfg-grid-size")?.value || DEFAULT_GRID);
    const pixPerSec = sqPerSecToPixPerSec(this.animSpeedSqPerSec, gridSize);

    const seg = this._currentSegment;
    if (seg >= path.length - 1) {
      // Chegou ao fim
      if (this.loop) {
        this._currentSegment = 0;
        this._progress = 0;
      } else {
        this.running = false;
        UIController.setStatus("Caminho concluído! ✅", "success");
        UIController.markTokenActive(token.id, false);
        OBRBridge.notify(`${token.name} chegou ao destino!`, "SUCCESS");
        return;
      }
    }

    const from = path[seg];
    const to   = path[seg + 1];
    const dx   = to.x - from.x;
    const dy   = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.5) {
      this._currentSegment++;
      this._progress = 0;
    } else {
      const step    = (pixPerSec * dt) / dist;
      this._progress = Math.min(1, this._progress + step);

      const nx = from.x + dx * this._progress;
      const ny = from.y + dy * this._progress;

      OBRBridge.setTokenPosition(token.id, nx, ny);

      if (this._progress >= 1) {
        this._currentSegment++;
        this._progress = 0;
      }
    }

    this._animFrame = requestAnimationFrame(ts => this._tick(ts, path, token));
  },

  async _redrawTrail(overridePath) {
    const path = overridePath || this.waypoints;
    if (path.length < 2) { await this._clearTrail(); return; }
    const token = TokenRegistry.selected;
    const color = token?.color || "#c9a84c";
    this._trailId = await OBRBridge.drawPathLine(
      path, color,
      this.lineWidth,
      this._trailId || `pf-trail-${Date.now()}`
    );
  },

  async _clearTrail() {
    if (this._trailId) {
      await OBRBridge.removeShape(this._trailId);
      this._trailId = null;
    }
  },
};

// ═══════════════════════════════════════════════════════
//  AI ENGINE — locomoção autônoma
// ═══════════════════════════════════════════════════════

const AIEngine = {
  running: false,
  mode: "wander",          // wander | patrol | chase | flee
  targetTokenId: null,
  speedSqPerSec: 2,
  detectRadius: 5,
  stopOnCollision: true,
  avoidTokens: true,
  showRadius: false,
  patrolWaypoints: [],     // [{ x, y }]
  _patrolIndex: 0,

  _tokenId: null,          // token controlado pela IA
  _animFrame: null,
  _lastTime: null,
  _wanderTarget: null,
  _trailId: null,

  get token() { return TokenRegistry.tokens.find(t => t.id === this._tokenId) || null; },

  start() {
    const token = TokenRegistry.selected;
    if (!token) { UIController.setStatus("Selecione um token para a IA.", "error"); return; }
    this._tokenId = token.id;
    this.running  = true;
    this._lastTime = null;
    this._wanderTarget = null;

    document.getElementById("ai-status-panel").classList.add("visible");
    document.getElementById("ai-target-text").textContent =
      `Modo: ${this._getModeLabel()}`;

    UIController.markTokenActive(token.id, true);
    OBRBridge.notify(`IA ligada para ${token.name}`, "INFO");

    this._animFrame = requestAnimationFrame(ts => this._tick(ts));
  },

  stop() {
    this.running = false;
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this._animFrame = null;
    document.getElementById("ai-status-panel").classList.remove("visible");
    if (this._tokenId) UIController.markTokenActive(this._tokenId, false);
    this._tokenId = null;
  },

  _getModeLabel() {
    return { wander: "Vagar", patrol: "Patrulha", chase: "Perseguir", flee: "Fugir" }[this.mode] || this.mode;
  },

  async _tick(timestamp) {
    if (!this.running) return;

    if (this._lastTime === null) this._lastTime = timestamp;
    const dt = (timestamp - this._lastTime) / 1000;
    this._lastTime = timestamp;

    const gridSize = parseInt(document.getElementById("cfg-grid-size")?.value || DEFAULT_GRID);
    const pixPerSec = sqPerSecToPixPerSec(this.speedSqPerSec, gridSize);

    const pos = await OBRBridge.getTokenPosition(this._tokenId);
    if (!pos) { this._animFrame = requestAnimationFrame(ts => this._tick(ts)); return; }

    // ── Verifica colisão com outros tokens ──────────────────────────────────
    if (this.stopOnCollision) {
      const others = await this._getNearbyTokens(pos, gridSize * 1.2);
      if (others.length > 0) {
        const names = others.map(t => t.name || t.id).join(", ");
        document.getElementById("ai-step-text").textContent = `Contato: ${names}`;
        OBRBridge.notify(`${this.token?.name} parou — contato com ${names}`, "WARNING");
        this.stop();
        UIController.setStatus(`IA parou: contato com ${names}`, "warning");
        return;
      }
    }

    // ── Calcula próximo alvo de acordo com o modo ────────────────────────────
    let target = null;

    switch (this.mode) {
      case "wander":  target = await this._getWanderTarget(pos, gridSize); break;
      case "patrol":  target = this._getPatrolTarget(pos, gridSize);        break;
      case "chase":   target = await this._getChaseTarget(pos);             break;
      case "flee":    target = await this._getFleeTarget(pos, gridSize);    break;
    }

    if (!target) {
      this._animFrame = requestAnimationFrame(ts => this._tick(ts));
      return;
    }

    // ── Evitar tokens no caminho ─────────────────────────────────────────────
    let moveTarget = target;
    if (this.avoidTokens) {
      moveTarget = await this._avoidObstacles(pos, target, gridSize) || target;
    }

    // ── Mover em direção ao alvo ─────────────────────────────────────────────
    const dx   = moveTarget.x - pos.x;
    const dy   = moveTarget.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      const step = Math.min(pixPerSec * dt, dist);
      const nx   = pos.x + (dx / dist) * step;
      const ny   = pos.y + (dy / dist) * step;
      await OBRBridge.setTokenPosition(this._tokenId, nx, ny);
      document.getElementById("ai-step-text").textContent =
        `Pos: (${Math.round(nx)}, ${Math.round(ny)})`;
    }

    this._animFrame = requestAnimationFrame(ts => this._tick(ts));
  },

  // ── Vagar: escolhe destino aleatório quando chega ao atual ─────────────────
  async _getWanderTarget(pos, gridSize) {
    if (!this._wanderTarget) {
      this._wanderTarget = this._randomNearby(pos, gridSize, 3, 8);
    }
    const dx = this._wanderTarget.x - pos.x;
    const dy = this._wanderTarget.y - pos.y;
    if (Math.sqrt(dx * dx + dy * dy) < gridSize * 0.5) {
      this._wanderTarget = this._randomNearby(pos, gridSize, 3, 8);
    }
    return this._wanderTarget;
  },

  _randomNearby(pos, gridSize, minSq, maxSq) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = (minSq + Math.random() * (maxSq - minSq)) * gridSize;
    return { x: pos.x + Math.cos(angle) * dist, y: pos.y + Math.sin(angle) * dist };
  },

  // ── Patrulha: segue waypoints em loop ─────────────────────────────────────
  _getPatrolTarget(pos, gridSize) {
    if (!this.patrolWaypoints.length) return this._randomNearby(pos, gridSize, 2, 5);
    const wp = this.patrolWaypoints[this._patrolIndex];
    const dx = wp.x - pos.x;
    const dy = wp.y - pos.y;
    if (Math.sqrt(dx * dx + dy * dy) < gridSize * 0.6) {
      this._patrolIndex = (this._patrolIndex + 1) % this.patrolWaypoints.length;
    }
    return wp;
  },

  // ── Perseguir: vai em direção ao token alvo ────────────────────────────────
  async _getChaseTarget(pos) {
    if (!this.targetTokenId) return null;
    const tPos = await OBRBridge.getTokenPosition(this.targetTokenId);
    return tPos;
  },

  // ── Fugir: vai para o lado oposto ao token alvo ────────────────────────────
  async _getFleeTarget(pos, gridSize) {
    if (!this.targetTokenId) return this._randomNearby(pos, gridSize, 4, 10);
    const tPos = await OBRBridge.getTokenPosition(this.targetTokenId);
    if (!tPos) return null;
    const dx = pos.x - tPos.x;
    const dy = pos.y - tPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      x: pos.x + (dx / dist) * gridSize * 6,
      y: pos.y + (dy / dist) * gridSize * 6,
    };
  },

  // ── Colisão: retorna tokens próximos (exceto o próprio) ────────────────────
  async _getNearbyTokens(pos, radius) {
    const allOBR = await OBRBridge.getAllTokens();
    const nearby = [];
    for (const t of TokenRegistry.tokens) {
      if (t.id === this._tokenId) continue;
      const tPos = await OBRBridge.getTokenPosition(t.id);
      if (!tPos) continue;
      const dx = tPos.x - pos.x;
      const dy = tPos.y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        nearby.push(t);
      }
    }
    return nearby;
  },

  // ── Desvio simples: se há obstáculo, desvia 90° ────────────────────────────
  async _avoidObstacles(pos, target, gridSize) {
    const obstacles = await this._getNearbyTokens(pos, gridSize * 1.5);
    if (!obstacles.length) return target;
    const ob = obstacles[0];
    const obPos = await OBRBridge.getTokenPosition(ob.id);
    if (!obPos) return target;

    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    // Desvia perpendicular
    return {
      x: target.x - dy * 0.5,
      y: target.y + dx * 0.5,
    };
  },

  addPatrolWaypoint(x, y) {
    this.patrolWaypoints.push({ x: parseFloat(x), y: parseFloat(y) });
    UIController.renderAIWaypoints();
  },

  removePatrolWaypoint(i) {
    this.patrolWaypoints.splice(i, 1);
    UIController.renderAIWaypoints();
  },
};

// ═══════════════════════════════════════════════════════
//  UI CONTROLLER
// ═══════════════════════════════════════════════════════

const UIController = {
  _activeTokenIds: new Set(),
  _selectedColor: "#c9a84c",
  _pathMode: "manual",

  init() {
    this._bindTabs();
    this._bindTokenForm();
    this._bindMovementPanel();
    this._bindAIPanel();
    this._bindSettings();
    this.renderTokenList();
    this.renderWaypoints();
    this.renderAIWaypoints();
  },

  // ── TABS ──────────────────────────────────────────────────────────────────
  _bindTabs() {
    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
      });
    });
  },

  // ── TOKEN FORM ────────────────────────────────────────────────────────────
  _bindTokenForm() {
    // Sliders
    bind("input-speed", "input", v => {
      document.getElementById("input-speed-val").textContent = `${v} sq`;
    });

    // Cor
    document.querySelectorAll(".token-color-opt").forEach(opt => {
      opt.style.cssText += ";width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;";
      opt.addEventListener("click", () => {
        document.querySelectorAll(".token-color-opt").forEach(o => o.style.border = "2px solid transparent");
        opt.style.border = "2px solid white";
        this._selectedColor = opt.dataset.color;
      });
    });
    // Seleciona primeira cor por padrão
    document.querySelector(".token-color-opt")?.click();

    // Pick token ativo
    document.getElementById("btn-pick-token")?.addEventListener("click", async () => {
      const selected = await OBRBridge.getSelectedTokens();
      if (selected.length > 0) {
        document.getElementById("input-token-id").value = selected[0];
        this.setStatus("Token selecionado do mapa.", "success");
      } else {
        this.setStatus("Nenhum token selecionado no mapa.", "warning");
      }
    });

    // Adicionar token
    document.getElementById("btn-add-token")?.addEventListener("click", () => {
      const id      = document.getElementById("input-token-id").value.trim();
      const name    = document.getElementById("input-token-name").value.trim();
      const type    = document.getElementById("input-token-type").value;
      const subtype = document.getElementById("input-token-subtype").value;
      const speed   = parseInt(document.getElementById("input-speed").value || 6);
      const color   = this._selectedColor;

      if (!id || !name) {
        this.setStatus("Preencha ID e Nome do token.", "error"); return;
      }

      const pfInfo  = getPFType(subtype);
      const success = TokenRegistry.add({ id, name, type, subtype, speed, color,
        icon: pfInfo.icon, label: pfInfo.label });
      if (success) {
        this.setStatus(`Token "${name}" registrado!`, "success");
        document.getElementById("input-token-id").value  = "";
        document.getElementById("input-token-name").value = "";
      }
    });
  },

  // ── MOVEMENT PANEL ────────────────────────────────────────────────────────
  _bindMovementPanel() {
    bind("anim-speed", "input", v => {
      document.getElementById("anim-speed-val").textContent = `${v} sq/s`;
    });

    // Modo manual / clique
    document.getElementById("btn-mode-manual")?.addEventListener("click", () => {
      this._pathMode = "manual";
      document.getElementById("btn-mode-manual").classList.replace("btn-ghost", "btn-gold");
      document.getElementById("btn-mode-click").classList.replace("btn-gold",  "btn-ghost");
      document.getElementById("manual-path-ui").style.display = "block";
    });
    document.getElementById("btn-mode-click")?.addEventListener("click", () => {
      this._pathMode = "click";
      document.getElementById("btn-mode-click").classList.replace("btn-ghost", "btn-gold");
      document.getElementById("btn-mode-manual").classList.replace("btn-gold",  "btn-ghost");
      document.getElementById("manual-path-ui").style.display = "none";
      this.setStatus("Clique no mapa para adicionar waypoints.", "info");
      OBRBridge.onMapClick(({ x, y }) => PathEngine.addWaypoint(x, y));
    });

    // Waypoint manual
    document.getElementById("btn-add-wp")?.addEventListener("click", () => {
      const x = document.getElementById("wp-x").value;
      const y = document.getElementById("wp-y").value;
      if (x === "" || y === "") { this.setStatus("Informe X e Y.", "error"); return; }
      PathEngine.addWaypoint(x, y);
      document.getElementById("wp-x").value = "";
      document.getElementById("wp-y").value = "";
    });

    // Controles
    document.getElementById("toggle-loop")?.addEventListener("change",  e => PathEngine.loop = e.target.checked);
    document.getElementById("toggle-trail")?.addEventListener("change", e => PathEngine.showTrail = e.target.checked);

    document.getElementById("btn-start-path")?.addEventListener("click",  () => PathEngine.start());
    document.getElementById("btn-stop-path")?.addEventListener("click",   () => PathEngine.stop());
    document.getElementById("btn-clear-path")?.addEventListener("click",  () => {
      PathEngine.stop();
      PathEngine.clearWaypoints();
      this.setStatus("Caminho limpo.", "info");
    });
  },

  // ── AI PANEL ─────────────────────────────────────────────────────────────
  _bindAIPanel() {
    bind("ai-speed", "input", v => {
      document.getElementById("ai-speed-val").textContent = `${v} sq/s`;
      AIEngine.speedSqPerSec = parseFloat(v);
    });
    bind("ai-detect-radius", "input", v => {
      document.getElementById("ai-detect-val").textContent = `${v} sq`;
      AIEngine.detectRadius = parseInt(v);
    });

    document.getElementById("ai-mode")?.addEventListener("change", e => {
      AIEngine.mode = e.target.value;
      const showTarget  = ["chase", "flee"].includes(e.target.value);
      const showPatrol  = e.target.value === "patrol";
      document.getElementById("ai-target-section").style.display  = showTarget  ? "block" : "none";
      document.getElementById("ai-patrol-section").style.display  = showPatrol  ? "block" : "none";
    });

    document.getElementById("ai-target-token")?.addEventListener("change", e => {
      AIEngine.targetTokenId = e.target.value || null;
    });

    document.getElementById("toggle-stop-collision")?.addEventListener("change", e => {
      AIEngine.stopOnCollision = e.target.checked;
    });
    document.getElementById("toggle-avoid-tokens")?.addEventListener("change", e => {
      AIEngine.avoidTokens = e.target.checked;
    });
    document.getElementById("toggle-show-radius")?.addEventListener("change", e => {
      AIEngine.showRadius = e.target.checked;
    });

    // Waypoints patrulha IA
    document.getElementById("btn-add-ai-wp")?.addEventListener("click", () => {
      const x = document.getElementById("ai-wp-x").value;
      const y = document.getElementById("ai-wp-y").value;
      if (x === "" || y === "") return;
      AIEngine.addPatrolWaypoint(x, y);
      document.getElementById("ai-wp-x").value = "";
      document.getElementById("ai-wp-y").value = "";
    });

    document.getElementById("btn-ai-start")?.addEventListener("click", () => AIEngine.start());
    document.getElementById("btn-ai-stop")?.addEventListener("click",  () => {
      AIEngine.stop();
      this.setStatus("IA desligada.", "warning");
    });
  },

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  _bindSettings() {
    bind("cfg-line-width", "input", v => {
      document.getElementById("cfg-line-val").textContent = `${v}px`;
      PathEngine.lineWidth = parseInt(v);
    });

    document.getElementById("cfg-grid-size")?.addEventListener("change", e => {
      OBRBridge.gridSize = parseInt(e.target.value) || DEFAULT_GRID;
    });

    document.getElementById("btn-export-tokens")?.addEventListener("click", () => {
      const json = TokenRegistry.exportJSON();
      const blob = new Blob([json], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "pf-tokens.json"; a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById("btn-import-tokens")?.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = ".json";
      input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const ok = TokenRegistry.importJSON(ev.target.result);
          this.setStatus(ok ? "Tokens importados!" : "Erro ao importar.", ok ? "success" : "error");
        };
        reader.readAsText(file);
      };
      input.click();
    });

    document.getElementById("btn-clear-all")?.addEventListener("click", () => {
      if (!confirm("Apagar todos os tokens? Esta ação não pode ser desfeita.")) return;
      AIEngine.stop();
      PathEngine.stop();
      PathEngine.clearWaypoints();
      TokenRegistry.tokens = [];
      TokenRegistry._selectedId = null;
      TokenRegistry._save();
      this.renderTokenList();
      this.syncMovementPanel();
      this.syncAIPanel();
      this.setStatus("Todos os dados limpos.", "warning");
    });
  },

  // ── RENDER TOKEN LIST ──────────────────────────────────────────────────────
  renderTokenList() {
    const list = document.getElementById("token-list");
    if (!list) return;

    if (!TokenRegistry.tokens.length) {
      list.innerHTML = `<div class="empty-state"><div class="icon">⚔️</div><div>Nenhum token registrado.<br/>Adicione abaixo.</div></div>`;
      return;
    }

    list.innerHTML = TokenRegistry.tokens.map(t => {
      const isSelected = t.id === TokenRegistry._selectedId;
      const isActive   = this._activeTokenIds.has(t.id);
      const badgeClass = t.type === "mount" ? "badge-mount" : "badge-character";

      return `
        <div class="token-item ${isSelected ? "selected" : ""} ${isActive ? "active-path" : ""}"
             data-id="${t.id}">
          <div class="token-dot" style="background:${t.color}"></div>
          <div class="token-info">
            <div class="token-name">${t.icon || ""} ${t.name}</div>
            <div class="token-meta">
              <span class="type-badge ${badgeClass}">${t.label || t.subtype}</span>
              &nbsp;${t.speed} sq/turno
            </div>
          </div>
          <div class="token-actions">
            <button class="btn btn-ghost btn-sm" onclick="UIController.selectToken('${t.id}')">✓</button>
            <button class="btn btn-red btn-sm"   onclick="TokenRegistry.remove('${t.id}')">✕</button>
          </div>
        </div>`;
    }).join("");

    // Atualiza seletor de alvo IA
    this._refreshAITargetSelect();
  },

  selectToken(id) {
    TokenRegistry.select(id);
    this.setStatus(`Token "${TokenRegistry.selected?.name}" selecionado.`, "info");
  },

  markTokenActive(id, active) {
    if (active) this._activeTokenIds.add(id);
    else        this._activeTokenIds.delete(id);
    this.renderTokenList();
  },

  // ── SYNC MOVEMENT ─────────────────────────────────────────────────────────
  syncMovementPanel() {
    const token = TokenRegistry.selected;
    const el    = document.getElementById("movement-token-selector");
    if (!el) return;
    if (!token) {
      el.innerHTML = `<div style="color:var(--text-dim);font-size:13px;text-align:center">Selecione um token na aba ⚔ Tokens</div>`;
    } else {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:12px;height:12px;border-radius:50%;background:${token.color};flex-shrink:0"></div>
          <div>
            <div style="font-size:13px;font-weight:600">${token.icon || ""} ${token.name}</div>
            <div style="font-size:11px;color:var(--text-dim)">${token.label || token.subtype} · ${token.speed} sq/turno</div>
          </div>
        </div>`;
    }
  },

  syncAIPanel() {
    const token = TokenRegistry.selected;
    const el    = document.getElementById("ai-token-selector");
    if (!el) return;
    if (!token) {
      el.innerHTML = `<div style="color:var(--text-dim);font-size:13px;text-align:center">Selecione um token na aba ⚔ Tokens</div>`;
    } else {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:12px;height:12px;border-radius:50%;background:${token.color};flex-shrink:0"></div>
          <div>
            <div style="font-size:13px;font-weight:600">${token.icon || ""} ${token.name}</div>
            <div style="font-size:11px;color:var(--text-dim)">${token.label || token.subtype} · IA disponível</div>
          </div>
        </div>`;
    }
  },

  // ── RENDER WAYPOINTS ──────────────────────────────────────────────────────
  renderWaypoints() {
    const el = document.getElementById("waypoint-list");
    if (!el) return;
    if (!PathEngine.waypoints.length) {
      el.innerHTML = `<div style="font-size:12px;color:var(--text-dim);text-align:center;padding:8px">Nenhum waypoint</div>`;
      return;
    }
    el.innerHTML = PathEngine.waypoints.map((wp, i) => `
      <div class="waypoint-item">
        <div class="waypoint-num">${i + 1}</div>
        <div class="waypoint-coords">(${Math.round(wp.x)}, ${Math.round(wp.y)})</div>
        <div class="waypoint-del" onclick="PathEngine.removeWaypoint(${i})">✕</div>
      </div>`).join("");
  },

  renderAIWaypoints() {
    const el = document.getElementById("ai-waypoint-list");
    if (!el) return;
    if (!AIEngine.patrolWaypoints.length) {
      el.innerHTML = `<div style="font-size:12px;color:var(--text-dim);text-align:center;padding:8px">Nenhum waypoint</div>`;
      return;
    }
    el.innerHTML = AIEngine.patrolWaypoints.map((wp, i) => `
      <div class="waypoint-item">
        <div class="waypoint-num">${i + 1}</div>
        <div class="waypoint-coords">(${Math.round(wp.x)}, ${Math.round(wp.y)})</div>
        <div class="waypoint-del" onclick="AIEngine.removePatrolWaypoint(${i})">✕</div>
      </div>`).join("");
  },

  _refreshAITargetSelect() {
    const sel = document.getElementById("ai-target-token");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">— Selecionar —</option>` +
      TokenRegistry.tokens
        .filter(t => t.id !== TokenRegistry._selectedId)
        .map(t => `<option value="${t.id}" ${t.id === current ? "selected" : ""}>${t.icon || ""} ${t.name}</option>`)
        .join("");
  },

  // ── STATUS BAR ────────────────────────────────────────────────────────────
  setStatus(msg, type = "info") {
    const el = document.getElementById("status-bar");
    if (!el) return;
    el.className = type;
    el.textContent = msg;
    if (type === "success") {
      setTimeout(() => { if (el.textContent === msg) el.className = ""; }, 4000);
    }
  },
};

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════

function bind(id, event, callback) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(event, e => callback(e.target.value));
}

// Fallback se pathfinder-types.js ainda não carregou
if (typeof sqPerSecToPixPerSec === "undefined") {
  window.sqPerSecToPixPerSec = (sq, grid) => sq * grid;
}
if (typeof getPFType === "undefined") {
  window.getPFType = (sub) => ({ label: sub, icon: "⚔️", defaultSpeed: 6 });
}

// ═══════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════
OBRBridge.init();

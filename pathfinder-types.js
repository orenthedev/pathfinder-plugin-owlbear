/**
 * pathfinder-types.js
 * Definições de tipos de personagens e montarias Pathfinder 2e
 * com velocidades base, cores padrão e metadados visuais.
 */

window.PF_TYPES = {

  // ─── CHARACTERS ───────────────────────────────────────────────────────────
  fighter: {
    label: "Fighter",
    type: "character",
    defaultSpeed: 6,       // quadrados por turno (30ft)
    color: "#e74c3c",
    icon: "⚔️",
    description: "Guerreiro treinado em combate corpo a corpo.",
  },
  wizard: {
    label: "Wizard",
    type: "character",
    defaultSpeed: 5,       // 25ft
    color: "#3498db",
    icon: "🧙",
    description: "Conjurador arcano de alta inteligência.",
  },
  rogue: {
    label: "Rogue",
    type: "character",
    defaultSpeed: 6,
    color: "#2c3e50",
    icon: "🗡️",
    description: "Ladrão ágil especializado em furtividade.",
  },
  cleric: {
    label: "Cleric",
    type: "character",
    defaultSpeed: 5,
    color: "#f39c12",
    icon: "✝️",
    description: "Sacerdote divino curador e protetor.",
  },
  ranger: {
    label: "Ranger",
    type: "character",
    defaultSpeed: 6,
    color: "#27ae60",
    icon: "🏹",
    description: "Rastreador habilidoso das terras selvagens.",
  },
  paladin: {
    label: "Paladin",
    type: "character",
    defaultSpeed: 5,
    color: "#e8c77a",
    icon: "🛡️",
    description: "Cavaleiro sagrado de causa justa.",
  },
  druid: {
    label: "Druid",
    type: "character",
    defaultSpeed: 5,
    color: "#1e8449",
    icon: "🌿",
    description: "Guardião da natureza com magia primordial.",
  },
  barbarian: {
    label: "Barbarian",
    type: "character",
    defaultSpeed: 7,      // 35ft (fast movement)
    color: "#c0392b",
    icon: "🪓",
    description: "Guerreiro furioso de grande resistência.",
  },
  bard: {
    label: "Bard",
    type: "character",
    defaultSpeed: 6,
    color: "#8e44ad",
    icon: "🎶",
    description: "Artista versátil com magia occulta.",
  },
  monk: {
    label: "Monk",
    type: "character",
    defaultSpeed: 6,
    color: "#16a085",
    icon: "👊",
    description: "Mestre das artes marciais sem armadura.",
  },
  sorcerer: {
    label: "Sorcerer",
    type: "character",
    defaultSpeed: 5,
    color: "#9b59b6",
    icon: "🔮",
    description: "Mago de poderes inatos e ancestrais.",
  },
  alchemist: {
    label: "Alchemist",
    type: "character",
    defaultSpeed: 5,
    color: "#d35400",
    icon: "⚗️",
    description: "Especialista em poções e bombas alquímicas.",
  },
  champion: {
    label: "Champion",
    type: "character",
    defaultSpeed: 5,
    color: "#c9a84c",
    icon: "👑",
    description: "Defensor sagrado de divindade.",
  },
  investigator: {
    label: "Investigator",
    type: "character",
    defaultSpeed: 5,
    color: "#7f8c8d",
    icon: "🔎",
    description: "Detetive inteligente e estrategista.",
  },
  oracle: {
    label: "Oracle",
    type: "character",
    defaultSpeed: 5,
    color: "#e8dfc8",
    icon: "🌀",
    description: "Visionário amaldiçoado com poderes divinos.",
  },
  swashbuckler: {
    label: "Swashbuckler",
    type: "character",
    defaultSpeed: 6,
    color: "#1abc9c",
    icon: "⚡",
    description: "Duelista ágil de estilo e panache.",
  },
  witch: {
    label: "Witch",
    type: "character",
    defaultSpeed: 5,
    color: "#6c3483",
    icon: "🧹",
    description: "Conjuradora ligada a um patrono misterioso.",
  },
  custom: {
    label: "Custom Character",
    type: "character",
    defaultSpeed: 6,
    color: "#95a5a6",
    icon: "👤",
    description: "Personagem personalizado.",
  },

  // ─── MOUNTS ───────────────────────────────────────────────────────────────
  horse: {
    label: "Horse",
    type: "mount",
    defaultSpeed: 10,      // 50ft — cavalo padrão PF2e
    color: "#795548",
    icon: "🐴",
    description: "Montaria comum, rápida em terreno aberto.",
  },
  griffon: {
    label: "Griffon",
    type: "mount",
    defaultSpeed: 8,
    color: "#f1c40f",
    icon: "🦅",
    description: "Criatura híbrida que pode voar.",
    canFly: true,
  },
  wyvern: {
    label: "Wyvern",
    type: "mount",
    defaultSpeed: 9,
    color: "#117a65",
    icon: "🐉",
    description: "Dragão bípede venenoso.",
    canFly: true,
  },
  drake: {
    label: "Drake",
    type: "mount",
    defaultSpeed: 8,
    color: "#943126",
    icon: "🔥",
    description: "Dragão menor de elite.",
    canFly: true,
  },
  spider: {
    label: "Giant Spider",
    type: "mount",
    defaultSpeed: 6,
    color: "#1c2833",
    icon: "🕷️",
    description: "Aranha gigante que pode subir paredes.",
    canClimb: true,
  },
  wolf: {
    label: "Dire Wolf",
    type: "mount",
    defaultSpeed: 9,
    color: "#616a6b",
    icon: "🐺",
    description: "Lobo gigante de grande ferocidade.",
  },
  custom_mount: {
    label: "Custom Mount",
    type: "mount",
    defaultSpeed: 7,
    color: "#85929e",
    icon: "🐾",
    description: "Montaria personalizada.",
  },
};

/**
 * Retorna os dados de um subtipo, com fallback.
 */
window.getPFType = function(subtype) {
  return window.PF_TYPES[subtype] || window.PF_TYPES.custom;
};

/**
 * Converte quadrados/turno para pixels/segundo dado o tamanho do grid
 * e a velocidade de animação desejada.
 *
 * @param {number} animSpeedSqPerSec - quadrados por segundo de animação
 * @param {number} gridSize          - pixels por quadrado
 * @returns {number}                 - pixels por segundo
 */
window.sqPerSecToPixPerSec = function(animSpeedSqPerSec, gridSize) {
  return animSpeedSqPerSec * gridSize;
};

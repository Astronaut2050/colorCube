export const THEMES = {
  leaf: {
    board: "#263225",
    grid: "#384737",
    text: "#243126",
    panel: "#fffaf0",
    primary: "#437447",
    primaryText: "#ffffff",
    muted: "#756f61",
    blocks: ["#f2f7e8", "#c8daa0", "#8db84e", "#4d7c1a", "#2a4a0e"],
  },
  sky: {
    board: "#253344",
    grid: "#35485f",
    text: "#243126",
    panel: "#fffaf0",
    primary: "#2f6f9f",
    primaryText: "#ffffff",
    muted: "#756f61",
    blocks: ["#eef4fb", "#b8d4f0", "#5b9ed4", "#1e6db5", "#0d3b6e"],
  },
};

export function pickTheme() {
  const values = Object.values(THEMES);
  return values[Math.floor(Math.random() * values.length)];
}

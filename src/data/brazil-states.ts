// =============================================================
// Brazil States — SVG path data for the interactive map
// =============================================================
// These are simplified paths for the 26 states + DF.
// For production, replace with proper TopoJSON from:
//   https://github.com/codeforamerica/click_that_hood/blob/master/public/data/brazil-states.geojson
//   or https://github.com/tbrugz/geodata-br

export interface BrazilState {
  uf: string;
  name: string;
  // Center coordinates for label placement (relative to viewBox 0 0 800 750)
  cx: number;
  cy: number;
  // SVG path (simplified outlines, viewBox 0 0 800 750)
  path: string;
}

// Simplified state outlines — suitable for an overview map
// Note: These are approximations. For pixel-perfect borders,
// use D3-geo with a proper GeoJSON/TopoJSON file.
export const BRAZIL_STATES: BrazilState[] = [
  // NORTE
  { uf: "AM", name: "Amazonas", cx: 200, cy: 160, path: "M80 60 L340 60 L340 100 L380 100 L380 200 L340 250 L280 280 L200 280 L140 260 L80 220 L60 160 Z" },
  { uf: "PA", name: "Pará", cx: 420, cy: 160, path: "M340 60 L540 80 L560 120 L560 200 L520 240 L480 280 L420 300 L380 280 L340 250 L380 200 L380 100 L340 100 Z" },
  { uf: "AC", name: "Acre", cx: 100, cy: 270, path: "M40 240 L140 260 L200 280 L180 310 L100 310 L40 290 Z" },
  { uf: "RO", name: "Rondônia", cx: 230, cy: 310, path: "M180 280 L280 280 L300 320 L280 360 L220 360 L180 340 L180 310 Z" },
  { uf: "RR", name: "Roraima", cx: 260, cy: 40, path: "M220 0 L300 0 L320 40 L300 80 L260 80 L220 60 Z" },
  { uf: "AP", name: "Amapá", cx: 480, cy: 40, path: "M440 0 L520 0 L540 40 L540 80 L500 80 L460 60 Z" },
  { uf: "TO", name: "Tocantins", cx: 420, cy: 320, path: "M380 280 L420 300 L460 280 L460 340 L440 400 L400 400 L380 360 L380 320 Z" },

  // NORDESTE
  { uf: "MA", name: "Maranhão", cx: 510, cy: 210, path: "M460 160 L540 160 L560 200 L560 260 L520 280 L480 280 L460 260 L460 200 Z" },
  { uf: "PI", name: "Piauí", cx: 540, cy: 300, path: "M500 240 L560 240 L570 280 L570 340 L540 380 L510 360 L500 300 Z" },
  { uf: "CE", name: "Ceará", cx: 610, cy: 230, path: "M570 200 L640 200 L660 240 L640 280 L600 280 L570 260 Z" },
  { uf: "RN", name: "R. G. do Norte", cx: 670, cy: 230, path: "M640 210 L700 210 L710 240 L690 260 L640 260 Z" },
  { uf: "PB", name: "Paraíba", cx: 670, cy: 270, path: "M630 260 L710 260 L710 290 L630 290 Z" },
  { uf: "PE", name: "Pernambuco", cx: 660, cy: 310, path: "M600 290 L720 290 L720 320 L600 320 Z" },
  { uf: "AL", name: "Alagoas", cx: 680, cy: 340, path: "M640 320 L720 320 L720 350 L640 350 Z" },
  { uf: "SE", name: "Sergipe", cx: 680, cy: 370, path: "M650 350 L710 350 L710 380 L650 380 Z" },
  { uf: "BA", name: "Bahia", cx: 580, cy: 400, path: "M480 340 L570 340 L650 350 L680 400 L660 460 L600 500 L520 500 L480 460 L460 400 Z" },

  // CENTRO-OESTE
  { uf: "MT", name: "Mato Grosso", cx: 310, cy: 370, path: "M220 280 L380 280 L380 360 L400 400 L380 460 L300 460 L240 420 L220 360 Z" },
  { uf: "GO", name: "Goiás", cx: 430, cy: 440, path: "M380 400 L460 400 L480 440 L480 500 L440 520 L400 520 L380 480 Z" },
  { uf: "MS", name: "M. G. do Sul", cx: 310, cy: 500, path: "M240 460 L340 460 L380 480 L380 540 L340 580 L280 580 L240 540 Z" },
  { uf: "DF", name: "Distrito Federal", cx: 460, cy: 420, path: "M450 410 L475 410 L475 430 L450 430 Z" },

  // SUDESTE
  { uf: "MG", name: "Minas Gerais", cx: 530, cy: 490, path: "M440 440 L520 440 L580 460 L600 500 L580 540 L520 560 L460 540 L440 500 Z" },
  { uf: "ES", name: "Espírito Santo", cx: 620, cy: 500, path: "M590 470 L640 470 L650 510 L640 540 L600 540 L590 510 Z" },
  { uf: "RJ", name: "Rio de Janeiro", cx: 590, cy: 570, path: "M540 550 L620 550 L640 570 L620 590 L560 590 L540 570 Z" },
  { uf: "SP", name: "São Paulo", cx: 460, cy: 570, path: "M380 530 L460 530 L540 550 L540 590 L500 610 L440 610 L380 590 L370 560 Z" },

  // SUL
  { uf: "PR", name: "Paraná", cx: 400, cy: 620, path: "M340 590 L440 590 L460 610 L460 640 L420 660 L340 660 L320 640 L320 610 Z" },
  { uf: "SC", name: "Santa Catarina", cx: 400, cy: 670, path: "M340 660 L420 660 L440 680 L420 710 L360 710 L340 690 Z" },
  { uf: "RS", name: "R. G. do Sul", cx: 380, cy: 720, path: "M320 700 L420 700 L440 720 L420 760 L360 780 L300 760 L300 730 Z" },
];

// Quick lookup
export const stateByUf = Object.fromEntries(
  BRAZIL_STATES.map((s) => [s.uf, s])
);

import fs from 'node:fs';import opentype from 'opentype.js';
const bytes=fs.readFileSync('/System/Library/Fonts/Supplemental/Arial.ttf');const font=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
fs.writeFileSync('scripts/landmarks/fire-station-osdorp-lettering.json',JSON.stringify({source:'ARCAM current exterior photo 1-159.jpg',fontApproximation:'Arial Regular approximates the photographed narrow unbolded sans-serif, exact family unknown',lines:['Fanny','Blankers-Koen','Kazerne'].map(text=>({text,commands:font.getPath(text,0,0,100).commands}))}));

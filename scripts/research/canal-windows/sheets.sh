#!/bin/bash
# Compile the canal-window refits and render their photo | model | overlay sheets (+ 640 px gallery copies in staging,
# < 300 KB copies in docs/images/canal-windows). Ground offsets: where the street lies on each crop, read off the overlay.
set -e
cd "$(dirname "$0")/../../.."
HOUSES="cw-heren-175702:1.4 cw-heren-179665:1.8 cw-keizers-176393:1.6 cw-keizers-171052:2.85 cw-prinsen-179169:2.35 cw-heren-179684:3.4 cw-heren-176601:2.6 cw-prinsen-167765:3.6"
IDS=$(for h in $HOUSES; do printf "%s," "${h%%:*}"; done)
node --import tsx scripts/building-recipes/compile.ts --house="${IDS%,}" | grep -v "^ "
for h in $HOUSES; do
  node --import tsx scripts/research/canal-windows/sheet.ts --house="${h%%:*}" --ground="${h##*:}"
done
mkdir -p docs/images/canal-windows staging/canal-windows
node -e "
const sharp=require('sharp');(async()=>{for(const h of process.argv.slice(1)){const id=h.split(':')[0];
await sharp('artifacts/canal-windows/'+id+'/sheet.png').resize(640).png().toFile('staging/canal-windows/g640-'+id+'.png');
await sharp('artifacts/canal-windows/'+id+'/sheet.png').resize(960).jpeg({quality:78}).toFile('docs/images/canal-windows/'+id+'.jpg');}})()" $HOUSES
ls -la docs/images/canal-windows

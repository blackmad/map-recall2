import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import fs from 'node:fs';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2]);
const m = doc.getRoot().listMaterials()[0];
fs.writeFileSync(process.argv[3], m.getBaseColorTexture().getImage());

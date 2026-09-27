import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {requireDiskSpace,reusePanoramaFile,storePanoramaFile} from './panorama-file-cache.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'panorama-file-cache-'));
try{
 const source=path.join(root,'source.jpg'),target=path.join(root,'batch.jpg');await fs.writeFile(source,'immutable-pano');
 await reusePanoramaFile(source,target);await reusePanoramaFile(source,target);
 assert.equal((await fs.stat(source)).ino,(await fs.stat(target)).ino,'same-volume reuse shares inode');
 assert.equal(await fs.readFile(target,'utf8'),'immutable-pano');
 const newFile=path.join(root,'new.jpg');await storePanoramaFile(newFile,Buffer.from('first'));
 await storePanoramaFile(newFile,Buffer.from('replacement'));
 assert.equal(await fs.readFile(newFile,'utf8'),'first','existing source never overwritten');
 assert.deepEqual((await fs.readdir(root)).filter(f=>f.endsWith('.partial')),[]);
 await assert.rejects(requireDiskSpace(root,0,Number.MAX_SAFE_INTEGER),/disk-space-reserve/);
 await assert.rejects(reusePanoramaFile(path.join(root,'absent'),path.join(root,'missing')),/ENOENT/);
 console.log('Panorama file cache: immutable hardlink reuse, atomic publication and disk reserve passed');
}finally{await fs.rm(root,{recursive:true,force:true});}

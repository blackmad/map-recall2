// Bundle entry for `js/stamp-art.bundle.js` (global CanalRecallStampArt).
import { buurtStampCanvas, drawBuurtStamp, loadStampFont, STAMP_ART_SIZE, type StampArt } from './stampAlbumStamp.ts';

const art: StampArt = { buurtStampCanvas, drawBuurtStamp, loadStampFont, STAMP_ART_SIZE };
if (typeof window !== 'undefined') window.CanalRecallStampArt = art;
export default art;

// Side-effect import: the browser's Math.cos / Math.sin for this process (browserMath.ts). Import it FIRST, before
// any module that computes a constant with cos/sin at load time.
import { installBrowserMath } from './browserMath.js';
installBrowserMath();

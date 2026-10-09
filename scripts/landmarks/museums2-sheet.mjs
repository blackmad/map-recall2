// node museums2-sheet.mjs <out.png> <cellWidth> <label=path>...   — horizontal contact sheet (cells cropped to fit)
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const [out,cell,...items]=process.argv.slice(2);const w=Number(cell);
const cells=items.map(s=>{const i=s.indexOf('=');const label=s.slice(0,i),p=s.slice(i+1);const [path,crop]=p.split('@');return `<figure><img src="data:image/${path.endsWith('.png')?'png':'jpeg'};base64,${fs.readFileSync(path).toString('base64')}" style="${crop??''}"><figcaption>${label}</figcaption></figure>`}).join('');
const html=`<style>body{margin:0;background:#222;display:flex;gap:6px;font:14px system-ui;color:#eee}figure{margin:0;width:${w}px;height:${Math.round(w*.75)+22}px;overflow:hidden;position:relative}img{width:${w}px;height:${Math.round(w*.75)}px;object-fit:cover;display:block}figcaption{height:22px;line-height:22px;padding-left:6px;background:#111}</style>${cells}`;
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:(w+6)*items.length,height:Math.round(w*.75)+22}});await page.setContent(html);await page.waitForTimeout(300);await page.screenshot({path:out});}finally{await browser.close()}

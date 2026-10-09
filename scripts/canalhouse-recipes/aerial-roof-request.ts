export function aerialRoofRequest(polygons:number[][][][][],year:number,paddingM=4){
 if(!Number.isInteger(year)||year<2016||year>2100||!Number.isFinite(paddingM)||paddingM<0||paddingM>15)throw Error('Invalid aerial year/context padding');
 const points=polygons.flat(3);
 if(!points.length||points.some(p=>p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>300000||p[1]<300000||p[1]>650000))throw Error('Aerial crop requires finite native EPSG28992 polygons');
 const bbox=[Math.floor(Math.min(...points.map(p=>p[0]))-paddingM),Math.floor(Math.min(...points.map(p=>p[1]))-paddingM),Math.ceil(Math.max(...points.map(p=>p[0]))+paddingM),Math.ceil(Math.max(...points.map(p=>p[1]))+paddingM)];
 const spanX=bbox[2]-bbox[0],spanY=bbox[3]-bbox[1];
 if(spanX<=0||spanY<=0||Math.max(spanX,spanY)>120)throw Error('Aerial crop must be a bounded building or small-row request');
 const width=Math.ceil(spanX/.08),height=Math.ceil(spanY/.08);
 const url=new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
 url.search=new URLSearchParams({service:'WMS',version:'1.3.0',request:'GetMap',layers:`${year}_orthoHR`,styles:'',crs:'EPSG:28992',bbox:bbox.join(','),width:String(width),height:String(height),format:'image/jpeg'}).toString();
 return {url:url.href,bbox,width,height,year,layer:`${year}_orthoHR`,requestedResolutionM:.08};
}

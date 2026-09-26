/** Shared metric brick shader. No texture allocation or per-brick geometry.
 * Derivative-based fade removes mortar before it aliases at a distance. */
export function appearanceBrickMaterial(THREE:any,colour:string,upAxis:'y'|'z'='y') {
  const material=new THREE.MeshStandardMaterial({color:colour,roughness:.94,side:THREE.DoubleSide});
  material.customProgramCacheKey=()=>`appearance-brick-v1-${upAxis}`;
  material.onBeforeCompile=(shader:any)=>{
    shader.vertexShader='varying vec3 facadeMetricPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfacadeMetricPosition = position;');
    shader.fragmentShader='varying vec3 facadeMetricPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 brickUp = ${upAxis==='y'?'vec3(0.,1.,0.)':'vec3(0.,0.,1.)'};
      vec3 brickNormal = normalize(cross(dFdx(facadeMetricPosition), dFdy(facadeMetricPosition)));
      vec3 brickTangent = normalize(cross(brickUp,brickNormal));
      vec2 brickMetres = vec2(dot(facadeMetricPosition,brickTangent),dot(facadeMetricPosition,brickUp));
      float brickRow = floor(brickMetres.y / .065);
      vec2 brickCell = vec2(brickMetres.x / .22 + mod(brickRow,2.)*.5, brickMetres.y / .065);
      vec2 brickEdge = min(fract(brickCell),1.-fract(brickCell));
      vec2 brickAA = max(fwidth(brickCell),vec2(.001));
      float brickInterior = smoothstep(.016,.016+brickAA.x,brickEdge.x)*smoothstep(.045,.045+brickAA.y,brickEdge.y);
      float brickFade = 1.-smoothstep(.15,.65,max(brickAA.x,brickAA.y));
      float brickVariation = fract(sin(dot(floor(brickCell),vec2(12.9898,78.233)))*43758.5453);
      diffuseColor.rgb *= mix(1., mix(1.13,.96+brickVariation*.08,brickInterior),brickFade);
    `);
  };
  return material;
}

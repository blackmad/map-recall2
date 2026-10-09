import type {CanalhouseOpeningGroup} from './canalhouseOpeningGroups.ts';

export type CanalhouseOpeningFrame=CanalhouseOpeningGroup['frame'];
export interface CanalhouseOpeningTemplateSelection {
  template:string;
  /** Explicit source-selected exceptions. Arrays replace the complete pattern. */
  overrides?:Partial<CanalhouseOpeningFrame>;
}

const plain:CanalhouseOpeningFrame={trimWidthM:.075,frameDepthM:.12,mullionWidthM:.035,verticalBars:[],horizontalBars:[]};
const panel=(rect:[number,number,number,number],frameWidthM:number):NonNullable<CanalhouseOpeningFrame['panels']>[number]=>({rect,frameWidthM,reliefM:.025,fieldReliefM:.007,frameSurface:'door'});
const cellar:CanalhouseOpeningFrame={...plain,trimWidthM:.045,frameDepthM:.08,paneOffsetM:.03,frameSurface:'door',barSurface:'door'};

/** Construction patterns, not claims about any particular house. A recipe must
 * select a pattern from references and supply observed placement/dimensions.
 * These share the older library's template/override authoring convention;
 * geometry still belongs to the current opening compiler. */
const templates:Record<string,CanalhouseOpeningFrame>={
  'plain-frame':plain,
  'oval-attic-frame':{...plain,head:'oval',trimWidthM:.055,frameDepthM:.1},
  // Source-selected wider perimeter with a restrained sash. Pane counts remain
  // the recipe's responsibility; this pattern supplies no interior divisions.
  'broad-sash-frame':{...plain,trimWidthM:.12,frameDepthM:.16,mullionWidthM:.03},
  'broad-dark-paired-sash':{...plain,trimWidthM:.12,frameDepthM:.16,mullionWidthM:.03,verticalBars:[.5],horizontalBars:[.5,.75],barSurface:'door'},
  'sash-four-by-four':{...plain,verticalBars:[.25,.5,.75],horizontalBars:[.25,.5,.75]},
  'sash-four-by-three':{...plain,verticalBars:[.25,.5,.75],horizontalBars:[.33,.67]},
  'sash-single-three':{...plain,horizontalBars:[.33,.67]},
  'sash-pair-three':{...plain,verticalBars:[.5],horizontalBars:[.33,.67]},
  'four-panel-door':{...plain,panels:[panel([.1,.75,.34,.17],.045),panel([.56,.75,.34,.17],.045),panel([.1,.13,.34,.53],.045),panel([.56,.13,.34,.53],.045)]},
  'diamond-transom':{...plain,diagonalBars:[[[.5,.09],[.91,.5]],[[.91,.5],[.5,.91]],[[.5,.91],[.09,.5]],[[.09,.5],[.5,.09]]]},
  'dark-cellar-frame':cellar,
  'paneled-cellar-leaf':{...cellar,mullionWidthM:.014,panels:[panel([.14,.07,.72,.16],.025),panel([.14,.3,.72,.62],.025)]},
};

export function canalhouseOpeningTemplate(selection:CanalhouseOpeningTemplateSelection):CanalhouseOpeningFrame {
  if(!selection||typeof selection.template!=='string'||!Object.prototype.hasOwnProperty.call(templates,selection.template))throw Error(`Unknown canalhouse opening template: ${selection?.template}`);
  const overrides=selection.overrides??{};
  for(const key of Object.keys(overrides))if(!Object.prototype.hasOwnProperty.call(plain,key)&&!['paneOffsetM','recessM','recessReturns','projectionM','frameSurface','barSurface','horizontalBarWidthsM','diagonalBars','panels','head','headRiseM','paneSurface','paneTint'].includes(key))throw Error(`Unsupported opening template override: ${key}`);
  return structuredClone({...templates[selection.template],...overrides});
}

/** Include only the selected patterns in an exported recipe so its component
 * choices remain inspectable without private sources or a matching code version. */
export function canalhouseOpeningTemplateDefinitions(names:string[]):Record<string,CanalhouseOpeningFrame> {
  return Object.fromEntries([...new Set(names)].sort().map(template=>[template,canalhouseOpeningTemplate({template})]));
}

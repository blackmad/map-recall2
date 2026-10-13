import type {BuildingTools} from './cultural-builders';
import {buildTortureMuseum} from './torture-museum-builder';
import {buildTheoThijssenMuseum} from './theo-thijssen-museum-builder';
import {buildPatheDeMunt} from './pathe-de-munt-builder';
import {buildHouseboatMuseum} from './houseboat-museum-builder';
/** Builders of the survey-shell museums, keyed by model id. */
export const museums2Builders:Record<string,(w:number,d:number,b:BuildingTools)=>void>={'houseboat-museum':buildHouseboatMuseum,'pathe-de-munt':buildPatheDeMunt,'torture-museum':buildTortureMuseum,'theo-thijssen-museum':buildTheoThijssenMuseum};

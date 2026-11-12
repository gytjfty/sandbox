import {CONFIG} from './config.js';
import {sub,scale,dot,length,unit} from './physics.js';
export const AU=149597870700;
export const SUN_RADIUS=695700000;
export const SUN_STANDOFF=1000000;
export const SUN_POSITION=Object.freeze(scale(unit([1,.6,1]),AU));
export const SUN_BOUNDARY=SUN_RADIUS+SUN_STANDOFF;
export const MAX_CRUISE_SPEED=1000000000;
export function sunVector(p){return sub(SUN_POSITION,p);}
export function solarClearance(p){return length(sunVector(p))-SUN_BOUNDARY;}
export function cruiseSpeed(p,boost=false){const gap=Math.max(0,Math.min(length(p)-CONFIG.worldRadius,solarClearance(p)));return Math.min(MAX_CRUISE_SPEED,Math.max(8,gap*2)*(boost?4:1));}
export function clipSolarMotion(p,delta){const magnitude=length(delta);if(!magnitude)return delta;const v=sub(p,SUN_POSITION),distance=length(v),radius=SUN_BOUNDARY+1.01;if(distance<SUN_BOUNDARY-.001)throw Error('Navigation is inside the stellar exclusion boundary.');if(distance<radius)return dot(v,delta)>=0?delta:[0,0,0];const d=scale(delta,1/magnitude),along=-dot(v,d);if(along<=0)return delta;const perpendicular=sub(v,scale(d,dot(v,d))),disc=radius**2-dot(perpendicular,perpendicular);if(disc<0)return delta;const root=Math.sqrt(disc),entry=((distance-radius)*(distance+radius))/(along+root);if(entry<0||entry>magnitude)return delta;return scale(d,Math.max(0,entry-.001));}
export function clipNavigationMotion(p,delta){const clipped=clipSolarMotion(p,delta);let fraction=1;for(let a=0;a<3;a++){if(clipped[a]>0)fraction=Math.min(fraction,(1e12-p[a])/clipped[a]);else if(clipped[a]<0)fraction=Math.min(fraction,(-1e12-p[a])/clipped[a]);}return scale(clipped,Math.max(0,fraction));}
export function validNavigation(n){return !!n&&Array.isArray(n.p)&&n.p.length===3&&n.p.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e12)&&length(n.p)>1&&solarClearance(n.p)>=-.001&&Array.isArray(n.f)&&n.f.length===3&&n.f.every(Number.isFinite)&&length(n.f)>.9&&length(n.f)<1.1&&typeof n.fly==='boolean'&&typeof n.cruise==='boolean'&&Number.isFinite(n.vy)&&Math.abs(n.vy)<=1e6;}
export function navigation(player){return {p:player.p.slice(),f:player.f.slice(),fly:player.fly,cruise:!!player.cruise,vy:player.vy};}
export function travelStatus(p){return {earthAltitude:length(p)-CONFIG.worldRadius,sunDistance:length(sunVector(p)),sunClearance:solarClearance(p),sunPosition:[...SUN_POSITION],earthSunDistance:AU,sunRadius:SUN_RADIUS,boundaryRadius:SUN_BOUNDARY};}

import { CONFIG, TAN_HALF_FOV } from './config.js';
import { add, sub, scale, dot, unit, cross, rotate } from './physics.js';
export function cameraBasis(player, forward) {
  const right = unit(cross(forward, unit(player.p)));
  return { right, up: unit(cross(right, forward)) };
}
export function screenRay(x, y, player, forward, width, height) {
  const basis = cameraBasis(player, forward);
  return unit(add(add(forward, scale(basis.right, (x / width * 2 - 1) * width / height * TAN_HALF_FOV)),
    scale(basis.up, (1 - y / height * 2) * TAN_HALF_FOV)));
}
export function project(position, player, forward, width, height) {
  if (!player) return null;
  const delta = sub(position, player.p), depth = dot(delta, forward);
  if (depth < 0.05) return null;
  const basis = cameraBasis(player, forward);
  return [width * (0.5 + dot(delta, basis.right) / (2 * depth * TAN_HALF_FOV * (width / height))),
    height * (0.5 - dot(delta, basis.up) / (2 * depth * TAN_HALF_FOV))];
}
export function lookDirection(forward, player, dx, dy) {
  const up = unit(player.p);
  const yaw = unit(rotate(forward, up, -dx * CONFIG.mouseSensitivity));
  const right = unit(cross(yaw, up));
  const candidate = unit(rotate(yaw, right, -dy * CONFIG.mouseSensitivity));
  return Math.abs(dot(candidate, up)) < 0.9998 ? candidate : yaw;
}

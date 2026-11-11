import { CONFIG } from './config.js';
export const add = (a, b) => a.map((value, i) => value + b[i]);
export const sub = (a, b) => a.map((value, i) => value - b[i]);
export const scale = (a, factor) => a.map(value => value * factor);
export const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
export const length = a => Math.hypot(...a);
export function unit(a) {
  const magnitude = length(a);
  return magnitude ? scale(a, 1 / magnitude) : [0, 1, 0];
}
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function rotate(vector, axis, angle) {
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  return add(add(scale(vector, cosine), scale(cross(axis, vector), sine)),
    scale(axis, dot(axis, vector) * (1 - cosine)));
}
function properties(body) {
  const mass = body.units * CONFIG.density;
  return { inverseMass: 1 / mass, inverseInertia: 1 / (0.4 * mass * body.r * body.r) };
}
function impulse(a, b, normal, restitution = 0.08) {
  const A = properties(a);
  const B = b ? properties(b) : { inverseMass: 0, inverseInertia: 0 };
  const armA = scale(normal, -a.r), armB = b ? scale(normal, b.r) : [0, 0, 0];
  let relative = sub(add(a.v, cross(a.w, armA)), b ? add(b.v, cross(b.w, armB)) : [0, 0, 0]);
  const normalSpeed = dot(relative, normal);
  if (normalSpeed >= 0) return;
  const magnitude = -(1 + restitution) * normalSpeed / (A.inverseMass + B.inverseMass);
  a.v = add(a.v, scale(normal, magnitude * A.inverseMass));
  if (b) b.v = sub(b.v, scale(normal, magnitude * B.inverseMass));
  relative = sub(add(a.v, cross(a.w, armA)), b ? add(b.v, cross(b.w, armB)) : [0, 0, 0]);
  const tangent = sub(relative, scale(normal, dot(relative, normal)));
  const tangentSpeed = length(tangent);
  if (tangentSpeed < 1e-9) return;
  const direction = scale(tangent, 1 / tangentSpeed);
  const denominator = A.inverseMass + B.inverseMass + a.r * a.r * A.inverseInertia
    + (b ? b.r * b.r * B.inverseInertia : 0);
  const frictionMagnitude = Math.max(-0.65 * magnitude, -tangentSpeed / denominator);
  const friction = scale(direction, frictionMagnitude);
  a.v = add(a.v, scale(friction, A.inverseMass));
  a.w = add(a.w, scale(cross(armA, friction), A.inverseInertia));
  if (b) {
    b.v = sub(b.v, scale(friction, B.inverseMass));
    b.w = sub(b.w, scale(cross(armB, friction), B.inverseInertia));
  }
}
function terrainNormal(position, field) {
  const step = 0.02, normal = [];
  for (let axis = 0; axis < 3; axis++) {
    const a = position.slice(), b = position.slice();
    a[axis] += step; b[axis] -= step;
    normal.push(field(a) - field(b));
  }
  return unit(normal);
}
export function stepPhysics(bodies, field, dt, player = null,
  gravity = position => scale(unit(position), -CONFIG.gravity)) {
  for (const body of bodies) {
    body.v = add(body.v, scale(gravity(body.p), dt));
    const speed = length(body.v);
    if (speed > CONFIG.maxBodySpeed) body.v = scale(body.v, CONFIG.maxBodySpeed / speed);
    body.p = add(body.p, scale(body.v, dt));
  }
  for (let iteration = 0; iteration < CONFIG.contactIterations; iteration++) {
    for (const body of bodies) {
      const distance = field(body.p) - body.r;
      if (distance < 0.001) {
        const normal = terrainNormal(body.p, field);
        if (distance < 0) body.p = add(body.p, scale(normal, -distance + 0.0002));
        impulse(body, null, normal);
      }
      if (player) {
        const up = unit(player);
        for (const height of CONFIG.playerOffsets) {
          const centre = add(player, scale(up, -height));
          const delta = sub(body.p, centre), distance = length(delta);
          const penetration = body.r + CONFIG.playerRadius - distance;
          if (penetration > 0) {
            const normal = distance > 1e-9 ? scale(delta, 1 / distance) : up;
            body.p = add(body.p, scale(normal, penetration + 0.0001));
            impulse(body, null, normal, 0);
          }
        }
      }
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j], delta = sub(a.p, b.p);
        const distance = length(delta), penetration = a.r + b.r - distance;
        if (penetration < -0.001) continue;
        const normal = distance > 1e-9 ? scale(delta, 1 / distance) : [1, 0, 0];
        const A = properties(a), B = properties(b);
        if (penetration > 0) {
          const correction = (penetration + 0.0001) * 0.8 / (A.inverseMass + B.inverseMass);
          a.p = add(a.p, scale(normal, correction * A.inverseMass));
          b.p = sub(b.p, scale(normal, correction * B.inverseMass));
        }
        impulse(a, b, normal);
      }
    }
  }
  for (const body of bodies) {
    body.w = scale(body.w, 0.9995);
    if (length(body.v) < 0.003 && field(body.p) - body.r < 0.002) body.v = [0, 0, 0];
  }
}

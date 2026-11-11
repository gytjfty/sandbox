import { CONFIG, VERSION, TAN_HALF_FOV } from './config.js';
import { unit, cross, sub, length } from './physics.js';
export class Renderer {
  constructor(canvas, notify) {
    this.canvas = canvas; this.notify = notify;
    this.nodes = new Float64Array(); this.ops = []; this.generation = 0;
    this.ready = false; this.lost = false; this.submitted = 0; this.completed = 0;
    this.losses = 0; this.fps = 0; this.error = ''; this.anchor = [NaN, NaN, NaN];
    this.quality = this.resolutionScale();
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.losses++; this.lost = true; this.ready = false; this.fence = null;
      notify('Graphics lost. Simulation continues. Restore graphics, or use B for a world backup.');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false; this.init().catch(error => this.fail(error));
    });
  }
  resolutionScale() {
    return Math.max(1, globalThis.devicePixelRatio || 1,
      CONFIG.minimumRenderHeight / Math.max(1, globalThis.innerHeight || CONFIG.minimumRenderHeight));
  }
  fail(error) {
    this.error = error.message || String(error); this.ready = false;
    this.notify(`Renderer: ${this.error} Simulation is independent.`);
  }
  async init() {
    this.ready = false;
    const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.gl = gl;
    if (!gl) throw Error('WebGL 2 unavailable.');
    const sources = await Promise.all(['terrain.vert', 'terrain.frag'].map(async path => {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw Error(`${path} HTTP ${response.status}`);
      return response.text();
    }));
    if (gl.isContextLost()) return;
    const program = gl.createProgram(), shaders = [];
    for (let i = 0; i < 2; i++) {
      const shader = gl.createShader(i ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER);
      gl.shaderSource(shader, sources[i]); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed.');
      gl.attachShader(program, shader); shaders.push(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program) || 'Shader linking failed.');
    for (const shader of shaders) { gl.detachShader(program, shader); gl.deleteShader(shader); }
    if (this.fence) gl.deleteSync(this.fence);
    if (this.treeTexture) gl.deleteTexture(this.treeTexture);
    if (this.objectTexture) gl.deleteTexture(this.objectTexture);
    if (this.program) gl.deleteProgram(this.program);
    this.program = program; gl.useProgram(program); this.uniforms = {};
    for (const name of ['tree', 'objects', 'treeWidth', 'nodeCount', 'editCount', 'fillCount',
      'objectCount', 'cam', 'up', 'forward', 'right', 'viewUp', 'altitude', 'aspect', 'tanHalf', 'planetRadius']) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    this.treeTexture = this.texture(0); this.objectTexture = this.texture(1);
    gl.uniform1i(this.uniforms.tree, 0); gl.uniform1i(this.uniforms.objects, 1);
    gl.uniform1i(this.uniforms.treeWidth, CONFIG.terrainTextureWidth);
    gl.uniform1f(this.uniforms.tanHalf, TAN_HALF_FOV);
    gl.uniform1f(this.uniforms.planetRadius, CONFIG.worldRadius);
    this.anchor = [NaN, NaN, NaN]; this.uploaded = -1; this.fence = null;
    this.ready = true; this.error = '';
  }
  texture(index) {
    const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + index);
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.NEAREST);
    for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE);
    return texture;
  }
  terrain(nodes, ops) { this.nodes = nodes; this.ops = ops; this.generation++; }
  uploadTerrain(position) {
    const gl = this.gl, width = CONFIG.terrainTextureWidth;
    const anchor = position.map(value => Math.floor(value / CONFIG.anchorGridSize) * CONFIG.anchorGridSize);
    if (this.uploaded === this.generation && anchor.every((value, i) => value === this.anchor[i])) return;
    this.anchor = anchor;
    const height = Math.max(1, Math.ceil(this.nodes.length / 4 / width));
    if (height > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw Error('Terrain texture exceeds GPU capacity; world retained.');
    const data = new Float32Array(width * height * 4);
    for (let i = 0; i < this.nodes.length; i += 12) {
      for (let axis = 0; axis < 3; axis++) {
        data[i + axis] = this.nodes[i + axis] - anchor[axis];
        data[i + 4 + axis] = this.nodes[i + 4 + axis] - anchor[axis];
        data[i + 8 + axis] = this.nodes[i + 8 + axis] - anchor[axis];
      }
      data[i + 3] = this.nodes[i + 3]; data[i + 7] = this.nodes[i + 7]; data[i + 11] = this.nodes[i + 11];
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.treeTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
    this.uploaded = this.generation;
  }
  uploadObjects(bodies, previews) {
    const gl = this.gl, capacity = CONFIG.maxPhysicalParts + CONFIG.maxDraftParts;
    const data = new Float32Array(capacity * 8);
    let count = 0;
    const put = (position, radius, colour, opacity) => {
      if (count >= capacity) return;
      data.set([...sub(position, this.anchor), radius, ...colour, opacity], count++ * 8);
    };
    for (const body of bodies) put(body.p, body.r, [0.34, 0.29, 0.23], 1);
    for (const part of previews) put(part.p, part.r, part.selected ? [1, 0.72, 0.12] : [0.2, 0.8, 1], part.selected ? 0.55 : 0.33);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.objectTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, capacity * 2, 1, 0, gl.RGBA, gl.FLOAT, data);
    gl.uniform1i(this.uniforms.objectCount, count);
  }
  resize() {
    const gl = this.gl; this.quality = this.resolutionScale();
    const width = Math.max(1, Math.round(innerWidth * this.quality));
    const height = Math.max(1, Math.round(innerHeight * this.quality));
    const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS), maxBuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    if ((maxViewport && (width > maxViewport[0] || height > maxViewport[1]))
      || (maxBuffer && (width > maxBuffer || height > maxBuffer))) {
      throw Error('Requested full-resolution frame exceeds GPU limits. Resolution was not silently reduced.');
    }
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    if (gl.drawingBufferWidth !== undefined && (gl.drawingBufferWidth < width || gl.drawingBufferHeight < height)) {
      throw Error('Browser did not allocate the requested full-resolution drawing buffer.');
    }
    gl.viewport(0, 0, width, height);
  }
  draw(player, bodies, previews, now) {
    if (!this.ready || this.lost || !player) return false;
    const gl = this.gl;
    if (this.fence) {
      const status = gl.clientWaitSync(this.fence, 0, 0);
      if (status === gl.WAIT_FAILED) throw Error('GPU synchronization failed.');
      if (status === gl.TIMEOUT_EXPIRED) return false;
      gl.deleteSync(this.fence); this.fence = null; this.completed++;
    }
    if (this.lastDraw && now - this.lastDraw < 1000 / CONFIG.targetRenderFPS - 0.3) return false;
    this.lastDraw = now;
    this.uploadTerrain(player.p); gl.useProgram(this.program);
    this.uploadObjects(bodies, previews); this.resize();
    const up = unit(player.p), right = unit(cross(player.f, up)), viewUp = unit(cross(right, player.f));
    for (const [name, vector] of Object.entries({ cam: sub(player.p, this.anchor), up,
      forward: player.f, right, viewUp })) gl.uniform3fv(this.uniforms[name], vector);
    gl.uniform1f(this.uniforms.altitude, length(player.p) - CONFIG.worldRadius);
    gl.uniform1f(this.uniforms.aspect, this.canvas.width / this.canvas.height);
    gl.uniform1i(this.uniforms.nodeCount, this.nodes.length / 12);
    gl.uniform1i(this.uniforms.editCount, this.ops.length);
    gl.uniform1i(this.uniforms.fillCount, this.ops.filter(operation => operation.kind === 'fill').length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (gl.isContextLost()) return false;
    const error = gl.getError(); if (error !== gl.NO_ERROR) throw Error(`WebGL error ${error}`);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
    this.submitted++;
    if (!this.windowAt) { this.windowAt = now; this.windowFrames = 0; }
    this.windowFrames++;
    if (now - this.windowAt > 2000) {
      this.fps = this.windowFrames * 1000 / (now - this.windowAt);
      this.windowAt = now; this.windowFrames = 0;
    }
    return true;
  }
  restore() {
    if (this.gl?.isContextLost()) this.gl.getExtension('WEBGL_lose_context')?.restoreContext();
    else this.init().catch(error => this.fail(error));
  }
  report() {
    return { version: VERSION, targetFPS: CONFIG.targetRenderFPS, submitted: this.submitted,
      completed: this.completed, contextLosses: this.losses, renderFPS: this.fps,
      resolution: [this.canvas.width, this.canvas.height], quality: this.quality,
      resolutionMode: 'native-device-pixels-minimum-1080-high', automaticDownscaling: false,
      operations: this.ops.length, nodes: this.nodes.length / 12, error: this.error };
  }
}

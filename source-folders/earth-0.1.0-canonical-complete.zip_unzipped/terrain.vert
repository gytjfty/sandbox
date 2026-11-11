#version 300 es
precision highp float;
out vec2 screen;
void main() {
    vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    screen = position * 2.0 - 1.0;
    gl_Position = vec4(screen, 0, 1);
}

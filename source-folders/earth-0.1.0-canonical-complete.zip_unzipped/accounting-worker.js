import { measureChange, buildTree } from './terrain.js';
self.onmessage = ({ data }) => {
  try {
    const units = data.edit ? measureChange(data.edit, data.ops) : 0;
    const operations = data.edit ? [...data.ops, { ...data.edit, units }] : data.ops;
    const nodes = buildTree(operations);
    postMessage({ id: data.id, units, nodes }, [nodes.buffer]);
  } catch (error) {
    postMessage({ id: data.id, error: error.message });
  }
};

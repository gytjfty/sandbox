export function createPopulationWorker() {
  return new Worker(new URL('./population.worker.js', import.meta.url), { type: 'module' });
}

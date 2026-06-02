export function sourceHealth() {
  return {
    publicSearch: true,
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    browserWorker: process.env.BROWSER_WORKER_PROVIDER !== "disabled"
  };
}

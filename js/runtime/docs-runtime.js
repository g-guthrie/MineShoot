import './docs.js';

const runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
const docsRuntimeApi = runtime.GameDocs || null;

export function getDocsRuntimeApi() {
    return docsRuntimeApi;
}

export { docsRuntimeApi };
export default docsRuntimeApi;

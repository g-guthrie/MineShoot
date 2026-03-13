let threePromise = null;

function resolveThreeNamespace(moduleNs) {
    if (moduleNs && moduleNs.default && moduleNs.default.REVISION && !moduleNs.REVISION) {
        return moduleNs.default;
    }
    return moduleNs;
}

export function ensureThreeGlobal() {
    if (globalThis.THREE) return Promise.resolve(globalThis.THREE);
    if (!threePromise) {
        threePromise = import('three')
            .then(resolveThreeNamespace)
            .then(function (threeNs) {
                if (!globalThis.THREE) {
                    globalThis.THREE = threeNs;
                }
                return globalThis.THREE;
            })
            .catch(function (err) {
                threePromise = null;
                throw err;
            });
    }
    return threePromise;
}

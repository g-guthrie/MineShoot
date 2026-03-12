function cloneSerializable(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function createRemoteEntityChannel(options = {}) {
  const onEntityUpsert = typeof options.onEntityUpsert === 'function' ? options.onEntityUpsert : null;
  const onEntityRemove = typeof options.onEntityRemove === 'function' ? options.onEntityRemove : null;
  const snapshotMap = new Map();

  function upsertEntity(entity) {
    if (!entity || !entity.id) return null;
    const clone = cloneSerializable(entity);
    snapshotMap.set(clone.id, clone);
    if (onEntityUpsert) onEntityUpsert(cloneSerializable(clone));
    return cloneSerializable(clone);
  }

  function removeEntity(entityId) {
    const id = String(entityId || '');
    if (!id || !snapshotMap.has(id)) return false;
    snapshotMap.delete(id);
    if (onEntityRemove) onEntityRemove(id);
    return true;
  }

  return {
    clear() {
      const ids = Array.from(snapshotMap.keys());
      for (let i = 0; i < ids.length; i++) {
        removeEntity(ids[i]);
      }
    },
    upsertEntity,
    removeEntity,
    mutateEntity(entityId, mutator) {
      const id = String(entityId || '');
      if (!id || !snapshotMap.has(id) || typeof mutator !== 'function') return null;
      const working = cloneSerializable(snapshotMap.get(id));
      const nextEntity = mutator(working) || working;
      snapshotMap.set(id, nextEntity);
      if (onEntityUpsert) onEntityUpsert(cloneSerializable(nextEntity));
      return cloneSerializable(nextEntity);
    },
    applySnapshot(snapshot = {}) {
      const entities = Array.isArray(snapshot.entities) ? snapshot.entities : [];
      const delta = !!snapshot.delta;
      const removedEntityIds = Array.isArray(snapshot.removedEntityIds) ? snapshot.removedEntityIds : [];

      if (!delta) {
        const nextIds = new Set();
        for (let i = 0; i < entities.length; i++) {
          if (!entities[i] || !entities[i].id) continue;
          nextIds.add(String(entities[i].id));
        }
        const staleIds = [];
        snapshotMap.forEach((_entity, entityId) => {
          if (!nextIds.has(entityId)) staleIds.push(entityId);
        });
        for (let i = 0; i < staleIds.length; i++) {
          removeEntity(staleIds[i]);
        }
      }

      for (let i = 0; i < entities.length; i++) {
        upsertEntity(entities[i]);
      }

      for (let i = 0; i < removedEntityIds.length; i++) {
        removeEntity(removedEntityIds[i]);
      }
    },
    getEntity(entityId) {
      const entity = snapshotMap.get(String(entityId || ''));
      return cloneSerializable(entity || null);
    },
    getEntityName(entityId) {
      const entity = snapshotMap.get(String(entityId || ''));
      if (!entity) return '';
      return String(entity.username || entity.id || '');
    },
    getSnapshotMap() {
      return new Map(snapshotMap);
    }
  };
}

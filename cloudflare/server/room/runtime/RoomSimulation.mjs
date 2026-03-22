export function buildSnapshotDelta(options = {}) {
  const entities = Array.isArray(options.entities) ? options.entities : [];
  const toEntityState = options.toEntityState;
  const previousState = options.previousState instanceof Map ? options.previousState : new Map();
  const forceFull = !!options.forceFull;

  if (typeof toEntityState !== 'function') {
    throw new Error('Room simulation requires toEntityState.');
  }

  const serializedEntities = entities.map((entity) => toEntityState(entity));
  const nextEntityState = new Map();
  const changedEntities = [];
  const removedEntityIds = [];

  for (let i = 0; i < serializedEntities.length; i++) {
    const entityState = serializedEntities[i];
    const serialized = JSON.stringify(entityState);
    nextEntityState.set(entityState.id, serialized);
    if (forceFull || previousState.get(entityState.id) !== serialized) {
      changedEntities.push(entityState);
    }
  }

  previousState.forEach((_value, entityId) => {
    if (!nextEntityState.has(entityId)) {
      removedEntityIds.push(entityId);
    }
  });

  return {
    serializedEntities,
    changedEntities,
    removedEntityIds,
    nextEntityState
  };
}

export function buildSnapshotPayload(options = {}) {
  const delta = buildSnapshotDelta(options);
  return {
    nextEntityState: delta.nextEntityState,
    payload: {
      t: options.messageType || 'snapshot',
      serverTime: Number(options.serverTime || 0),
      delta: !options.forceFull,
      gameMode: options.gameMode || '',
      matchState: options.matchState || null,
      entities: options.forceFull ? delta.serializedEntities : delta.changedEntities,
      removedEntityIds: delta.removedEntityIds
    }
  };
}

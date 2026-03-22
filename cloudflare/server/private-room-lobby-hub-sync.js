export async function notifyPrivateRoomLobbyHub(env, roomId) {
  if (!env || !env.PRIVATE_ROOM_LOBBY_HUB || !roomId) return null;
  const id = env.PRIVATE_ROOM_LOBBY_HUB.idFromName(String(roomId || ''));
  const stub = env.PRIVATE_ROOM_LOBBY_HUB.get(id);
  const url = new URL('https://private-room-lobby/sync');
  url.searchParams.set('roomId', String(roomId || ''));
  return stub.fetch(url.toString(), {
    method: 'POST'
  }).catch(() => null);
}


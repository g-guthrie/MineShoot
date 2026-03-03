import { protocol } from '../../shared/protocol.js';

export function getSharedProtocol() {
  if (!protocol || typeof protocol !== 'object') {
    throw new Error('GameShared.protocol is missing.');
  }
  if (!protocol.msg || !protocol.msg.c2s || !protocol.msg.s2c) {
    throw new Error('GameShared.protocol.msg is missing required sections.');
  }
  return protocol;
}

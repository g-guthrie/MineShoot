import '../../shared/protocol.js';
import '../../shared/gameplay-tuning.js';
import '../../js/core/runtime-profile.js';
import { getDemonicRuntimeModes } from '../shared-compat/runtime-modes.js';
import { DEMONIC_WORKSTREAMS } from './workstreams.js';
import './shell.js';

globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
globalThis.__DEMONIC_RUNTIME.ModeRegistry = {
  getRuntimeModes: getDemonicRuntimeModes
};
globalThis.__DEMONIC_RUNTIME.Workstreams = {
  items: DEMONIC_WORKSTREAMS
};

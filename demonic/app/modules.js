import '../../shared/protocol.js';
import '../../shared/gameplay-tuning.js';
import '../../shared/runtime-modes.js';
import '../../js/core/runtime-profile.js';
import '../platform/display-settings.js';
import { getDemonicRuntimeModes } from '../shared-compat/runtime-modes.js';
import { buildDemonicMenuModel } from './menu-model.js';
import { DEMONIC_WORKSTREAMS } from './workstreams.js';
import './runtime-loader.js';
import './shell.js';

globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
globalThis.__DEMONIC_RUNTIME.ModeRegistry = {
  getRuntimeModes: getDemonicRuntimeModes
};
globalThis.__DEMONIC_RUNTIME.MenuModel = {
  build: buildDemonicMenuModel
};
globalThis.__DEMONIC_RUNTIME.Workstreams = {
  items: DEMONIC_WORKSTREAMS
};

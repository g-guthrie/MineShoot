#!/usr/bin/env node

const { buildReport } = require('./biome-map-lib.cjs');

process.stdout.write(buildReport('jungle').content);

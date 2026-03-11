#!/usr/bin/env node

const path = require('path');
const { writeAllReports } = require('./biome-map-lib.cjs');

const outputDir = path.resolve(__dirname, '..', 'docs', 'biome-maps');
const reports = writeAllReports(outputDir);

console.log(`Generated ${reports.length} biome ASCII maps in ${outputDir}`);

#!/usr/bin/env ts-node
/**
 * Generate OpenAPI specification from JSDoc comments
 * 
 * Usage: npm run generate:openapi
 * 
 * This script:
 * 1. Reads JSDoc @openapi comments from source files
 * 2. Generates OpenAPI 3.0 specification
 * 3. Writes to docs/api/openapi.yaml and public/openapi.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yamljs';
import { generateOpenApiSpec } from '../src/api/swaggerConfig';

const outputPaths = [
  path.join(__dirname, '../docs/api/openapi.yaml'),
  path.join(__dirname, '../public/openapi.yaml'),
  path.join(__dirname, '../dist/client/openapi.yaml'),
];

function main() {
  console.log('🚀 Generating OpenAPI specification...\n');

  try {
    const spec = generateOpenApiSpec();
    
    // Convert to YAML
    const yamlContent = YAML.stringify(spec, 10, 2);
    
    // Ensure output directories exist
    const dirs = new Set(outputPaths.map(p => path.dirname(p)));
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
    
    // Write to all output paths
    outputPaths.forEach(outputPath => {
      fs.writeFileSync(outputPath, yamlContent, 'utf-8');
      console.log(`✅ Written: ${outputPath}`);
    });
    
    // Also write JSON version
    const jsonPath = path.join(__dirname, '../docs/api/openapi.json');
    fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2), 'utf-8');
    console.log(`✅ Written: ${jsonPath}`);
    
    console.log('\n🎉 OpenAPI specification generated successfully!');
    console.log(`📊 Total endpoints documented: ${Object.keys(spec.paths || {}).length}`);
    console.log(`📝 Total schemas defined: ${Object.keys(spec.components?.schemas || {}).length}`);
    
  } catch (error) {
    console.error('❌ Failed to generate OpenAPI specification:', error);
    process.exit(1);
  }
}

main();
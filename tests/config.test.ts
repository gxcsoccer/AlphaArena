import fs from 'fs';
import path from 'path';

describe('Project Configuration', () => {
  const rootDir = path.resolve(__dirname, '..');

  describe('Environment Files', () => {
    it('should have .env.example file', () => {
      const envExamplePath = path.join(rootDir, '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });

    it('should not commit real API keys in .env.example', () => {
      const envExamplePath = path.join(rootDir, '.env.example');
      const content = fs.readFileSync(envExamplePath, 'utf-8');

      // Check that no real API keys are present
      expect(content).not.toMatch(/sk-[a-zA-Z0-9]+/);
      expect(content).not.toMatch(/api[_-]?key\s*=\s*['"][^'"]+['"]/i);
      expect(content).toContain('#');
    });
  });

  describe('Vite Configuration', () => {
    it('should have vite.config.ts file', () => {
      const viteConfigPath = path.join(rootDir, 'vite.config.ts');
      expect(fs.existsSync(viteConfigPath)).toBe(true);
    });

    it('should have correct Vite configuration', () => {
      const viteConfigPath = path.join(rootDir, 'vite.config.ts');
      const content = fs.readFileSync(viteConfigPath, 'utf-8');

      expect(content).toContain('@vitejs/plugin-react');
      expect(content).toContain('react()');
      expect(content).toContain('port: 3000');
    });
  });

  describe('ESLint Configuration', () => {
    it('should have an ESLint configuration file', () => {
      // Check for either eslint.config.js (new flat config) or .eslintrc.* (legacy format)
      const eslintConfigJs = path.join(rootDir, 'eslint.config.js');
      const eslintConfigMjs = path.join(rootDir, 'eslint.config.mjs');
      const eslintrcJson = path.join(rootDir, '.eslintrc.json');
      const eslintrcJs = path.join(rootDir, '.eslintrc.js');
      const eslintrcYaml = path.join(rootDir, '.eslintrc.yaml');
      const eslintrcYml = path.join(rootDir, '.eslintrc.yml');
      
      const hasEslintConfig = fs.existsSync(eslintConfigJs) || 
                              fs.existsSync(eslintConfigMjs) ||
                              fs.existsSync(eslintrcJson) || 
                              fs.existsSync(eslintrcJs) ||
                              fs.existsSync(eslintrcYaml) ||
                              fs.existsSync(eslintrcYml);
      // ESLint can also work without a config file using package.json eslintConfig
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const hasPackageJsonConfig = !!packageJson.eslintConfig;
      
      expect(hasEslintConfig || hasPackageJsonConfig).toBe(true);
    });
  });

  describe('Prettier Configuration', () => {
    it('should have .prettierrc file', () => {
      const prettierConfigPath = path.join(rootDir, '.prettierrc');
      expect(fs.existsSync(prettierConfigPath)).toBe(true);
    });

    it('should have correct Prettier settings', () => {
      const prettierConfigPath = path.join(rootDir, '.prettierrc');
      const content = fs.readFileSync(prettierConfigPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.semi).toBe(true);
      expect(config.singleQuote).toBe(true);
      expect(config.printWidth).toBe(100);
    });
  });

  describe('Vercel Configuration', () => {
    it('should have vercel.json file', () => {
      const vercelConfigPath = path.join(rootDir, 'vercel.json');
      expect(fs.existsSync(vercelConfigPath)).toBe(true);
    });

    it('should have correct Vercel configuration', () => {
      const vercelConfigPath = path.join(rootDir, 'vercel.json');
      const content = fs.readFileSync(vercelConfigPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.outputDirectory).toBe('dist/client');
      expect(config.framework).toBe('vite');
    });
  });

  describe('Package.json Scripts', () => {
    it('should have frontend scripts', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.scripts['build:client']).toBeDefined();
      expect(config.scripts['dev']).toBeDefined();
      expect(config.scripts['lint']).toBeDefined();
      expect(config.scripts['format']).toBeDefined();
    });
  });

  describe('Frontend Dependencies', () => {
    it('should have React installed', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.dependencies['react']).toBeDefined();
      expect(config.dependencies['react-dom']).toBeDefined();
    });

    it('should have Vite installed', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.devDependencies['vite']).toBeDefined();
      expect(config.devDependencies['@vitejs/plugin-react']).toBeDefined();
    });

    it('should have Recharts installed', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.dependencies['recharts']).toBeDefined();
    });
  });
});
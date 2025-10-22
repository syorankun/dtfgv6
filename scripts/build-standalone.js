#!/usr/bin/env node

/**
 * Build Standalone Generator
 *
 * Este script cria um arquivo HTML único que funciona com file://
 * - Lê o HTML, CSS e JS gerados pelo Vite
 * - Inline o CSS no <style>
 * - Inline o JS no <script>
 * - Gera dist-standalone/index.html que pode ser aberto diretamente
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist-standalone');
const htmlFile = path.join(distDir, 'index.html');

console.log('🔧 Gerando build standalone...');

// Verifica se o build existe
if (!fs.existsSync(htmlFile)) {
  console.error('❌ Erro: Execute "npm run build:standalone:pre" primeiro');
  process.exit(1);
}

// Lê o HTML
let html = fs.readFileSync(htmlFile, 'utf-8');

// Encontra e inline todos os arquivos CSS
const cssMatches = [];
const cssRegex = /<link[^>]*href="([^"]*\.css)"[^>]*>/g;
let cssMatch;
while ((cssMatch = cssRegex.exec(html)) !== null) {
  cssMatches.push({ tag: cssMatch[0], path: cssMatch[1] });
}

// Faz replace de cada CSS (depois do loop para evitar problemas com índices)
for (const match of cssMatches) {
  const cssPath = path.join(distDir, match.path);
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf-8');
    html = html.replace(match.tag, `<style>${css}</style>`);
    console.log(`✅ CSS inline: ${match.path}`);
  }
}

// Encontra e inline todos os arquivos JS
const jsMatches = [];
const jsRegex = /<script[^>]*src="([^"]*\.js)"[^>]*><\/script>/g;
let jsMatch;
while ((jsMatch = jsRegex.exec(html)) !== null) {
  jsMatches.push({ tag: jsMatch[0], path: jsMatch[1] });
}

// Faz replace de cada JS (depois do loop)
for (const match of jsMatches) {
  const jsPath = path.join(distDir, match.path);
  if (fs.existsSync(jsPath)) {
    const js = fs.readFileSync(jsPath, 'utf-8');
    // Mantém type="module" e crossorigin se existir
    const typeMatch = match.tag.match(/type="([^"]*)"/);
    const type = typeMatch ? typeMatch[1] : 'module';
    html = html.replace(match.tag, `<script type="${type}">${js}</script>`);
    console.log(`✅ JS inline: ${match.path}`);
  }
}

// Remove a pasta assets já que tudo está inline
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  fs.rmSync(assetsDir, { recursive: true, force: true });
  console.log('🗑️  Pasta assets removida (tudo inline agora)');
}

// Remove arquivos .map
const files = fs.readdirSync(distDir);
files.forEach(file => {
  if (file.endsWith('.map')) {
    fs.unlinkSync(path.join(distDir, file));
  }
});

// Adiciona comentário no início do HTML
const standaloneComment = `<!--
  ⚡ DJ DataForge v6 - STANDALONE BUILD

  Este arquivo funciona 100% offline, sem servidor HTTP!

  ✅ Pode ser aberto diretamente clicando duas vezes
  ✅ Funciona com protocolo file://
  ✅ Todo CSS e JavaScript estão inline
  ✅ Não requer instalação ou configuração

  Tamanho: ~${Math.round(html.length / 1024)}KB
  Gerado: ${new Date().toISOString()}
-->
`;

html = html.replace('<!DOCTYPE html>', `<!DOCTYPE html>\n${standaloneComment}`);

// Salva o HTML final
fs.writeFileSync(htmlFile, html, 'utf-8');

const sizeKB = Math.round(html.length / 1024);
const sizeMB = (sizeKB / 1024).toFixed(2);

console.log('\n✅ Build standalone concluído!');
console.log(`📦 Arquivo: dist-standalone/index.html`);
console.log(`📊 Tamanho: ${sizeKB}KB (${sizeMB}MB)`);
console.log('\n🚀 Você pode agora:');
console.log('   1. Abrir dist-standalone/index.html diretamente no navegador');
console.log('   2. Copiar para qualquer lugar (pen drive, email, etc)');
console.log('   3. Usar sem internet ou servidor\n');

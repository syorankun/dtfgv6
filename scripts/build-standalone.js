#!/usr/bin/env node

/**
 * Build Standalone Generator - VERSÃO CORRIGIDA
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

console.log('🔧 Gerando build standalone...\n');

// Verifica se o build existe
if (!fs.existsSync(htmlFile)) {
  console.error('❌ Erro: Execute "npm run build:standalone:pre" primeiro');
  process.exit(1);
}

// Lê o HTML original
let html = fs.readFileSync(htmlFile, 'utf-8');
console.log(`📄 HTML original: ${html.length} caracteres`);

// Função auxiliar para ler arquivos do dist
function readDistFile(relativePath) {
  const fullPath = path.join(distDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  Arquivo não encontrado: ${relativePath}`);
    return null;
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

// 1. Processar CSS - encontrar TODAS as tags <link> de CSS
console.log('\n📦 Processando CSS...');
const cssLinkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*>/g;
const cssLinks = [];
let match;

// Coletar todos os links
while ((match = cssLinkRegex.exec(html)) !== null) {
  const fullTag = match[0];
  const hrefMatch = fullTag.match(/href=["']([^"']+)["']/);
  if (hrefMatch) {
    cssLinks.push({
      fullTag: fullTag,
      href: hrefMatch[1]
    });
  }
}

console.log(`   Encontrados ${cssLinks.length} link(s) CSS`);

// Substituir cada link por <style> com conteúdo inline
for (const link of cssLinks) {
  const cssContent = readDistFile(link.href);
  if (cssContent) {
    html = html.replace(link.fullTag, `<style>${cssContent}</style>`);
    console.log(`   ✅ CSS inline: ${link.href} (${cssContent.length} chars)`);
  }
}

// 2. Processar JavaScript - encontrar TODAS as tags <script src>
console.log('\n📦 Processando JavaScript...');
const jsScriptRegex = /<script\s+([^>]*\s+)?src=["']([^"']+\.js)["']([^>]*)><\/script>/g;
const jsScripts = [];

// Coletar todos os scripts
html.replace(jsScriptRegex, (fullMatch, beforeSrc, src, afterSrc) => {
  jsScripts.push({
    fullTag: fullMatch,
    src: src,
    beforeSrc: beforeSrc || '',
    afterSrc: afterSrc || ''
  });
  return fullMatch;
});

console.log(`   Encontrados ${jsScripts.length} script(s) JavaScript`);

// Substituir cada script por versão inline
for (const script of jsScripts) {
  const jsContent = readDistFile(script.src);
  if (jsContent) {
    // Preservar atributos como type="module"
    const attrs = (script.beforeSrc + script.afterSrc).trim();
    const typeMatch = attrs.match(/type=["']([^"']+)["']/);
    const type = typeMatch ? typeMatch[1] : 'module';

    const inlineScript = `<script type="${type}">${jsContent}</script>`;
    html = html.replace(script.fullTag, inlineScript);
    console.log(`   ✅ JS inline: ${script.src} (${jsContent.length} chars)`);
  }
}

// 3. Remover a pasta assets
console.log('\n🗑️  Limpando assets...');
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  fs.rmSync(assetsDir, { recursive: true, force: true });
  console.log('   ✅ Pasta assets removida');
}

// 4. Remover arquivos .map
const files = fs.readdirSync(distDir);
let mapsRemoved = 0;
files.forEach(file => {
  if (file.endsWith('.map')) {
    fs.unlinkSync(path.join(distDir, file));
    mapsRemoved++;
  }
});
if (mapsRemoved > 0) {
  console.log(`   ✅ ${mapsRemoved} arquivo(s) .map removido(s)`);
}

// 5. Adicionar comentário no início
console.log('\n📝 Adicionando header...');
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

// 6. Salvar o HTML final
fs.writeFileSync(htmlFile, html, 'utf-8');

const sizeKB = Math.round(html.length / 1024);
const sizeMB = (sizeKB / 1024).toFixed(2);

console.log('\n✅ Build standalone concluído!');
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📦 Arquivo: dist-standalone/index.html`);
console.log(`📊 Tamanho: ${sizeKB}KB (${sizeMB}MB)`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log('\n🚀 Como usar:');
console.log('   1. Navegue até dist-standalone/');
console.log('   2. Clique DUAS VEZES em index.html');
console.log('   3. O arquivo abrirá no navegador');
console.log('   4. Pronto! Sem erros de CORS! 🎉\n');

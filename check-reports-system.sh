#!/bin/bash

echo "🔍 Verificando Sistema de Relatórios..."
echo ""

# Verifica arquivos
echo "📁 Verificando arquivos..."
FILES=(
  "src/plugins/loan/loan-report-templates.ts"
  "src/plugins/loan/loan-report-selector.ts"
  "src/plugins/loan/loan-report-builder.ts"
  "src/plugins/loan/loan-report-generator.ts"
  "src/plugins/loan/loan-report-manager.ts"
)

ALL_EXIST=true
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (FALTANDO)"
    ALL_EXIST=false
  fi
done

echo ""

# Verifica se loan-plugin.ts foi modificado
echo "🔧 Verificando integração no loan-plugin.ts..."
if grep -q "LoanReportManager" src/plugins/loan/loan-plugin.ts; then
  echo "  ✅ Import do LoanReportManager encontrado"
else
  echo "  ❌ Import do LoanReportManager NÃO encontrado"
  ALL_EXIST=false
fi

if grep -q "reportManager" src/plugins/loan/loan-plugin.ts; then
  echo "  ✅ Instância do reportManager encontrada"
else
  echo "  ❌ Instância do reportManager NÃO encontrada"
  ALL_EXIST=false
fi

if grep -q "Relatórios Avançados" src/plugins/loan/loan-plugin.ts; then
  echo "  ✅ Menu 'Relatórios Avançados' encontrado"
else
  echo "  ❌ Menu 'Relatórios Avançados' NÃO encontrado"
  ALL_EXIST=false
fi

echo ""

# Verifica TypeScript
echo "🔨 Verificando erros de TypeScript..."
ERROR_COUNT=$(npm run type-check 2>&1 | grep -c "error TS")
if [ "$ERROR_COUNT" -eq "0" ]; then
  echo "  ✅ Sem erros de TypeScript"
else
  echo "  ⚠️  $ERROR_COUNT erros de TypeScript encontrados"
  echo "  Execute 'npm run type-check' para ver detalhes"
fi

echo ""

# Verifica build
echo "📦 Status do Build..."
if [ -d "dist" ]; then
  echo "  ✅ Diretório dist/ existe"
  if [ -f "dist/index.html" ]; then
    echo "  ✅ dist/index.html existe"
  else
    echo "  ⚠️  dist/index.html não encontrado"
  fi
else
  echo "  ⚠️  Diretório dist/ não existe"
  echo "  Execute 'npm run build' primeiro"
fi

echo ""

# Resumo
echo "📊 RESUMO:"
if [ "$ALL_EXIST" = true ] && [ "$ERROR_COUNT" -eq "0" ]; then
  echo "  ✅ Sistema de Relatórios instalado corretamente!"
  echo ""
  echo "🚀 PRÓXIMOS PASSOS:"
  echo "  1. Execute: npm run dev"
  echo "  2. Abra: http://localhost:5173"
  echo "  3. Procure por: Empréstimos → 📊 Relatórios Avançados"
  echo ""
  echo "📖 Documentação:"
  echo "  - LOAN_REPORTS_SYSTEM.md (completa)"
  echo "  - QUICK_START_REPORTS.md (início rápido)"
else
  echo "  ⚠️  Alguns problemas foram encontrados"
  echo "  Verifique os itens marcados com ❌ acima"
fi

echo ""

import { initDB, migrarJSON, fechar } from './database.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const caminhoJSON = process.argv[2] || path.join(__dirname, 'licencas.json')

async function main() {
  console.log('Iniciando migração para Neon/PostgreSQL...')
  console.log(`Banco: ${process.env.DATABASE_URL ? 'configurado via DATABASE_URL' : 'NÃO CONFIGURADO'}`)

  if (!process.env.DATABASE_URL) {
    console.error('Erro: Configure a variável de ambiente DATABASE_URL')
    console.error('Exemplo: DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require')
    process.exit(1)
  }

  await initDB()
  console.log('Tabelas criadas/verificadas.')

  await migrarJSON(caminhoJSON)

  await fechar()
  console.log('Migração concluída com sucesso!')
}

main().catch(e => {
  console.error('Erro na migração:', e)
  process.exit(1)
})

// Restaura ou insere uma chave de licenca no banco Neon. Idempotente.
//
// Uso:
//   node restaurar-chave.js <CHAVE> [ID_MAQUINA] [OBS] [--dry-run]
//
// Exemplo:
//   node restaurar-chave.js CCJ-9F6W-H4FK-XJ92 f581f8796f99d86b49eebcd10d14650c "Nome do cliente"
//
// DATABASE_URL vem do ambiente. Se nao estiver definida, tenta ler de
// ../entrega/CREDENCIAIS-NAO-ENTREGAR.txt (apenas conveniencia local).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const FORMATO_CHAVE = /^[A-Z]{2,4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

function carregarDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const cred = path.join(__dirname, '..', 'entrega', 'CREDENCIAIS-NAO-ENTREGAR.txt')
  try {
    const m = fs.readFileSync(cred, 'utf-8').match(/postgresql:\/\/\S+/)
    if (m) return m[0]
  } catch {}
  return ''
}

function imprimir(r) {
  if (!r) return console.log('  (chave inexistente)')
  console.log(`  chave      : ${r.chave}`)
  console.log(`  obs        : ${r.obs || '(vazio)'}`)
  console.log(`  bloqueada  : ${r.bloqueada ? 'SIM' : 'não'}`)
  const maq = Array.isArray(r.maquinas) ? r.maquinas : []
  console.log(`  máquinas   : ${maq.length}/1${maq.length ? ' -> ' + maq.join(', ') : ''}`)
  console.log(`  criada em  : ${r.criada_em}`)
  console.log(`  ativada em : ${r.ativada_em || '(nunca)'}`)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const [chave, idMaquina, obs] = args.filter(a => a !== '--dry-run')

  if (!chave || !FORMATO_CHAVE.test(chave.trim().toUpperCase())) {
    console.error('Uso: node restaurar-chave.js <CHAVE> [ID_MAQUINA] [OBS] [--dry-run]')
    console.error('Ex.: node restaurar-chave.js CCJ-9F6W-H4FK-XJ92 f581f8796f99d86b49eebcd10d14650c "Nome"')
    process.exit(1)
  }

  const codigo = chave.trim().toUpperCase()
  const maquina = (idMaquina || '').trim().toLowerCase()
  if (maquina && !/^[a-f0-9]{16,64}$/.test(maquina)) {
    console.error(`AVISO: idMaquina "${maquina}" não parece um hash hex. Continuando mesmo assim.`)
  }

  const DATABASE_URL = carregarDatabaseUrl()
  if (!DATABASE_URL) {
    console.error('DATABASE_URL não encontrada (nem em entrega/CREDENCIAIS-NAO-ENTREGAR.txt).')
    process.exit(1)
  }

  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(DATABASE_URL)

  console.log(`\nChave: ${codigo}`)
  console.log(`Máquina: ${maquina || '(nenhuma informada)'}`)
  if (dryRun) console.log('*** DRY RUN — nenhuma alteração será gravada ***')

  const antes = await sql`SELECT * FROM chaves WHERE chave = ${codigo}`
  console.log('\nEstado ANTES:')
  imprimir(antes[0])

  if (!antes[0]) {
    const maquinas = maquina ? JSON.stringify([maquina]) : '[]'
    if (dryRun) {
      console.log('\nSeria inserida com maquinas=' + maquinas + '.')
    } else {
      await sql`INSERT INTO chaves (chave, maquinas, bloqueada, ativada_em, obs)
                VALUES (${codigo}, ${maquinas}::jsonb, false, ${maquina ? new Date().toISOString() : null}, ${obs || ''})`
      console.log('\nChave inserida.')
    }
  } else {
    const atual = antes[0]
    const maquinas = Array.isArray(atual.maquinas) ? atual.maquinas : []
    if (maquina && !maquinas.includes(maquina)) {
      if (maquinas.length >= 1) {
        console.error(`\nERRO: a chave já está em ${maquinas.length} máquina(s). Use "Resetar máquina" no painel admin antes de restaurar.`)
        process.exit(2)
      }
      if (dryRun) {
        console.log(`\nSeria adicionada a máquina ${maquina}.`)
      } else {
        await sql`UPDATE chaves SET maquinas = ${JSON.stringify([maquina])}::jsonb, ativada_em = NOW() WHERE chave = ${codigo}`
        console.log(`\nMáquina ${maquina} adicionada.`)
      }
    } else if (obs !== undefined) {
      if (dryRun) {
        console.log(`\nObs seria atualizada para "${obs || ''}".`)
      } else {
        await sql`UPDATE chaves SET obs = ${obs || ''} WHERE chave = ${codigo}`
        console.log(`\nObs atualizada para "${obs || ''}".`)
      }
    } else {
      console.log('\nNada a alterar.')
    }
    if (atual.bloqueada) console.log('ATENÇÃO: a chave está BLOQUEADA. Desbloqueie no painel admin se necessário.')
  }

  const depois = await sql`SELECT * FROM chaves WHERE chave = ${codigo}`
  console.log('\nEstado DEPOIS:')
  imprimir(depois[0])

  const total = await sql`SELECT COUNT(*)::int AS n FROM chaves`
  console.log(`\nTotal de chaves no banco: ${total[0].n}`)
}

main().catch(e => {
  console.error('\nFalha:', e.message)
  process.exit(1)
})

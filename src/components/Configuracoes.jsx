import { useState } from 'react'
import { Settings, PlusCircle, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtBRL, fmtPct } from '../api.js'
import ConfirmDialog from './ConfirmDialog.jsx'

function hojeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseValor(texto) {
  const bruto = String(texto ?? '').trim()
  if (bruto === '') return 0
  const n = parseFloat(bruto.replace(/[^\d.,]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export default function Configuracoes({ dados, onChange }) {
  const contas = dados.contas || []
  const config = dados.configuracoes || {}

  const [modalConta, setModalConta] = useState(false)
  const [editandoConta, setEditandoConta] = useState(null)
  const [formConta, setFormConta] = useState({ nome: '' })
  const [confirmar, setConfirmar] = useState(null)

  const abrirNovaConta = () => {
    setFormConta({ nome: '', saldoInicial: '', dataInicial: hojeLocal() })
    setEditandoConta(null)
    setModalConta(true)
  }

  const abrirEditarConta = (c) => {
    setFormConta({ nome: c.nome })
    setEditandoConta(c)
    setModalConta(true)
  }

  const fecharConta = () => {
    setModalConta(false)
    setEditandoConta(null)
    setFormConta({ nome: '' })
  }

  const salvarConta = async () => {
    if (!formConta.nome.trim()) {
      toast.error('Digite o nome da conta')
      return
    }
    const payload = { nome: formConta.nome.trim() }

    if (!editandoConta) {
      const saldoInicial = parseValor(formConta.saldoInicial)
      if (!Number.isFinite(saldoInicial) || saldoInicial < 0) {
        toast.error('Saldo inicial inválido')
        return
      }
      const dataBase = String(formConta.dataInicial || '').trim() || hojeLocal()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataBase) || Number.isNaN(Date.parse(`${dataBase}T00:00:00Z`))) {
        toast.error('Data inicial inválida')
        return
      }
      payload.saldoInicial = saldoInicial
      payload.dataBase = dataBase
    }

    try {
      if (editandoConta) {
        await api.editConta(editandoConta.id, payload)
        toast.success('Conta atualizada!')
      } else {
        await api.addConta(payload)
        toast.success('Conta criada!')
      }
      fecharConta()
      onChange()
    } catch (e) {
      toast.error('Erro ao salvar conta')
    }
  }

  const pedirExcluirConta = (c) => {
    setConfirmar({
      titulo: 'Excluir conta?',
      mensagem: `A conta "${c.nome}" e todos os cofrinhos vinculados serão removidos.`,
      acao: async () => {
        await api.delConta(c.id)
        onChange()
        toast.success('Conta excluída.')
      }
    })
  }

  return (
    <div className="config-pagina">
      <div className="config-section">
        <h3><Settings size={20} /> Configurações</h3>

        <div className="config-campo">
          <label>Taxa efetiva ao ano</label>
          <input
            type="text"
            value={fmtPct(config.taxaEfetivaAnual, 2)}
            readOnly
            disabled
          />
        </div>
        <div className="config-campo">
          <label>Taxa efetiva ao dia</label>
          <input
            type="text"
            value={fmtPct(config.taxaEfetivaDiaria, 4)}
            readOnly
            disabled
          />
        </div>
        <div className="config-observacao">
          {config.dataCalculo
            ? config.diasCalculo > 0
              ? `Calculado em ${config.dataCalculo} · ${config.diasCalculo} dia(s) corrido(s)`
              : `Última atualização em ${config.dataCalculo} — mesmo dia, sem taxa`
            : 'Aguardando a primeira atualização de saldo no Dashboard.'}
        </div>

        <div className="contas-lista">
          <h4>Contas Cadastradas</h4>
          {contas.length === 0 ? (
            <div className="historico-vazio">
              Nenhuma conta cadastrada. Adicione sua primeira conta financeira.
            </div>
          ) : (
            contas.map(c => (
              <div key={c.id} className="conta-item">
                <div className="conta-info">
                  <span className="conta-nome">{c.nome}</span>
                  <span className="conta-saldo">Saldo: {fmtBRL(c.saldoAtual)}</span>
                </div>
                <div className="conta-acoes">
                  <button className="btn-icone" title="Editar" onClick={() => abrirEditarConta(c)}>
                    <Pencil size={15} />
                  </button>
                  <button className="btn-icone perigo" title="Excluir" onClick={() => pedirExcluirConta(c)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
          <button className="btn-novo" onClick={abrirNovaConta} style={{ marginTop: 12 }}>
            <PlusCircle size={16} /> Adicionar Conta
          </button>
        </div>
      </div>

      {modalConta && (
        <div className="form-modal-overlay" onClick={fecharConta}>
          <div className="form-modal" onClick={e => e.stopPropagation()}>
            <h4>{editandoConta ? 'Editar Conta' : 'Nova Conta'}</h4>
            <div className="form-campo">
              <label>Nome da Conta</label>
              <input
                type="text"
                placeholder="Ex: 99Pay, NuConta"
                value={formConta.nome}
                onChange={e => setFormConta({ ...formConta, nome: e.target.value })}
              />
            </div>
            {!editandoConta && (
              <>
                <div className="form-campo">
                  <label>Saldo Inicial</label>
                  <input
                    type="text"
                    placeholder="Ex: 4.157,00"
                    title="Quanto tem nesta conta hoje. Esse valor vira o ponto de partida dos cálculos."
                    value={formConta.saldoInicial ?? ''}
                    onChange={e => setFormConta({ ...formConta, saldoInicial: e.target.value })}
                  />
                </div>
                <div className="form-campo">
                  <label>Data Inicial</label>
                  <input
                    type="date"
                    value={formConta.dataInicial ?? ''}
                    onChange={e => setFormConta({ ...formConta, dataInicial: e.target.value })}
                  />
                </div>
              </>
            )}
            <p style={{ fontSize: 12, color: 'var(--texto-fraco)', marginTop: 4 }}>
              {editandoConta
                ? 'O saldo é alterado apenas pelo Dashboard, para que os lançamentos e as taxas permaneçam consistentes.'
                : 'O saldo inicial define por onde a cadeia de cálculo começa — assim o primeiro lançamento não é confundido com juros. Depois disso, o saldo só muda pelo Dashboard.'}
            </p>
            <div className="form-botoes">
              <button className="btn-cancelar" onClick={fecharConta}>Cancelar</button>
              <button className="btn-salvar" onClick={salvarConta}>
                {editandoConta ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        aberto={!!confirmar}
        titulo={confirmar?.titulo}
        mensagem={confirmar?.mensagem}
        onCancelar={() => setConfirmar(null)}
        onConfirmar={() => { const a = confirmar?.acao; setConfirmar(null); a?.() }}
      />
    </div>
  )
}

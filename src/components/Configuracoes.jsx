import { useState } from 'react'
import { Settings, PlusCircle, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtBRL, fmtPct } from '../api.js'
import ConfirmDialog from './ConfirmDialog.jsx'

export default function Configuracoes({ dados, onChange }) {
  const contas = dados.contas || []
  const config = dados.configuracoes || {}

  const [modalConta, setModalConta] = useState(false)
  const [editandoConta, setEditandoConta] = useState(null)
  const [formConta, setFormConta] = useState({ nome: '' })
  const [confirmar, setConfirmar] = useState(null)

  const abrirNovaConta = () => {
    setFormConta({ nome: '' })
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
            <p style={{ fontSize: 12, color: 'var(--texto-fraco)', marginTop: 4 }}>
              O saldo é alterado apenas pelo Dashboard, para que os lançamentos e as taxas
              permaneçam consistentes.
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

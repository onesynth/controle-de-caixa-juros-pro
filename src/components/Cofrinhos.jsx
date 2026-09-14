import { useState, useMemo } from 'react'
import { PlusCircle, Pencil, Trash2, PiggyBank, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtBRL } from '../api.js'
import ConfirmDialog from './ConfirmDialog.jsx'

function calcularDiasRestantes(dataPrazo) {
  if (!dataPrazo) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prazo = new Date(dataPrazo + 'T00:00:00')
  const diff = prazo - hoje
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function corPrazo(dias) {
  if (dias === null) return null
  if (dias > 60) return 'verde'
  if (dias > 30) return 'amarelo'
  if (dias > 7) return 'laranja'
  if (dias > 0) return 'vermelho'
  return 'vencido'
}

function progressoPrazo(diasRestantes, dataCriacao) {
  if (diasRestantes === null) return null
  const criacao = new Date(dataCriacao + 'T00:00:00')
  const prazo = new Date()
  prazo.setMonth(prazo.getMonth())
  const total = calcularDiasTotais(dataCriacao, diasRestantes)
  if (total <= 0) return 100
  const elapsed = total - diasRestantes
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

function calcularDiasTotais(dataCriacao, diasRestantes) {
  if (!dataCriacao || diasRestantes === null) return 0
  const criacao = new Date(dataCriacao + 'T00:00:00')
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diasPassados = Math.ceil((hoje - criacao) / (1000 * 60 * 60 * 24))
  return diasPassados + diasRestantes
}

export default function Cofrinhos({ dados, onChange }) {
  const contas = dados.contas || []
  const cofrinhos = dados.cofrinhos || []
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const [form, setForm] = useState({ nome: '', valor: '', contaId: contas[0]?.id || '', dataPrazo: '' })

  const totalCofrinhos = cofrinhos.reduce((s, c) => s + Number(c.valor), 0)

  const abrirNovo = () => {
    setForm({ nome: '', valor: '', contaId: contas[0]?.id || '', dataPrazo: '' })
    setEditando(null)
    setModalAberto(true)
  }

  const abrirEditar = (c) => {
    setForm({ nome: c.nome, valor: String(c.valor), contaId: c.contaId, dataPrazo: c.dataPrazo || '' })
    setEditando(c)
    setModalAberto(true)
  }

  const fecharModal = () => {
    setModalAberto(false)
    setEditando(null)
    setForm({ nome: '', valor: '', contaId: contas[0]?.id || '', dataPrazo: '' })
  }

  const salvar = async () => {
    if (!form.nome.trim()) {
      toast.error('Digite o nome do cofrinho')
      return
    }
    if (!form.contaId) {
      toast.error('Selecione uma conta')
      return
    }
    const valor = parseFloat(form.valor.replace(/[^\d.,]/g, '').replace(',', '.')) || 0

    const payload = {
      nome: form.nome.trim(),
      valor,
      contaId: form.contaId,
      dataPrazo: form.dataPrazo || null
    }

    try {
      if (editando) {
        await api.editCofrinho(editando.id, payload)
        toast.success('Cofrinho atualizado!')
      } else {
        await api.addCofrinho(payload)
        toast.success('Cofrinho criado!')
      }
      fecharModal()
      onChange()
    } catch (e) {
      toast.error('Erro ao salvar cofrinho')
    }
  }

  const pedirExcluir = (c) => {
    setConfirmar({
      titulo: 'Excluir cofrinho?',
      mensagem: `"${c.nome}" será removido permanentemente.`,
      acao: async () => {
        await api.delCofrinho(c.id)
        onChange()
        toast.success('Cofrinho excluído.')
      }
    })
  }

  return (
    <div className="cofrinhos-pagina">
      <div className="cofrinhos-header">
        <h3><PiggyBank size={20} /> Meus Cofrinhos</h3>
        <button className="btn-novo" onClick={abrirNovo}>
          <PlusCircle size={16} /> Novo Cofrinho
        </button>
      </div>

      {cofrinhos.length === 0 ? (
        <div className="historico-vazio">
          Nenhum cofrinho cadastrado ainda. Clique em "Novo Cofrinho" para começar.
        </div>
      ) : (
        <>
          <div className="cofrinho-grid">
            {cofrinhos.map(c => {
              const diasRestantes = calcularDiasRestantes(c.dataPrazo)
              const cor = corPrazo(diasRestantes)
              const pctProgresso = progressoPrazo(diasRestantes, c.dataCriacao)

              return (
                <div key={c.id} className={`cofrinho-card ${cor ? 'com-prazo' : ''}`}>
                  <div className="cofrinho-nome">
                    <PiggyBank size={16} /> {c.nome}
                  </div>
                  <div className="cofrinho-conta">
                    {contas.find(ct => ct.id === c.contaId)?.nome || 'Conta não definida'}
                  </div>
                  <div className="cofrinho-valor">{fmtBRL(c.valor)}</div>

                  {c.dataPrazo && (
                    <div className="cofrinho-prazo-info">
                      <Clock size={12} />
                      <span>
                        {diasRestantes > 0
                          ? `${diasRestantes} dia(s) restante(s)`
                          : diasRestantes === 0
                            ? 'Vence hoje!'
                            : `Vencido há ${Math.abs(diasRestantes)} dia(s)`}
                      </span>
                      <span className="cofrinho-prazo-data">
                        {new Date(c.dataPrazo + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}

                  {c.dataPrazo && (
                    <div className="barra-prazo">
                      <div
                        className={`barra-prazo-fill ${cor}`}
                        style={{ width: `${pctProgresso}%` }}
                      />
                    </div>
                  )}

                  <div className="cofrinho-criado">
                    Criado em {c.dataCriacao || '—'}
                  </div>
                  <div className="cofrinho-acoes">
                    <button className="btn-icone" title="Editar" onClick={() => abrirEditar(c)}>
                      <Pencil size={15} />
                    </button>
                    <button className="btn-icone perigo" title="Excluir" onClick={() => pedirExcluir(c)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="cofrinho-total">
            <span className="total-label">Total em Cofrinhos</span>
            <span className="total-valor">{fmtBRL(totalCofrinhos)}</span>
          </div>
        </>
      )}

      {modalAberto && (
        <div className="form-modal-overlay" onClick={fecharModal}>
          <div className="form-modal" onClick={e => e.stopPropagation()}>
            <h4>{editando ? 'Editar Cofrinho' : 'Novo Cofrinho'}</h4>
            <div className="form-campo">
              <label>Nome do Cofrinho</label>
              <input
                type="text"
                placeholder="Ex: Reserva Emergência"
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="form-campo">
              <label>Valor</label>
              <input
                type="text"
                placeholder="Ex: 5.000,00"
                value={form.valor}
                onChange={e => setForm({ ...form, valor: e.target.value })}
              />
            </div>
            <div className="form-campo">
              <label>Conta de Origem</label>
              <select value={form.contaId} onChange={e => setForm({ ...form, contaId: e.target.value })}>
                <option value="">Selecione...</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="form-campo">
              <label>Data de Vencimento (opcional)</label>
              <input
                type="date"
                value={form.dataPrazo}
                onChange={e => setForm({ ...form, dataPrazo: e.target.value })}
              />
            </div>
            <div className="form-botoes">
              <button className="btn-cancelar" onClick={fecharModal}>Cancelar</button>
              <button className="btn-salvar" onClick={salvar}>
                {editando ? 'Salvar' : 'Criar'}
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

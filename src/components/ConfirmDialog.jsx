import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ aberto, titulo, mensagem, onCancelar, onConfirmar }) {
  if (!aberto) return null

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-icone">
          <AlertTriangle size={24} />
        </div>
        <h4>{titulo}</h4>
        <p>{mensagem}</p>
        <div className="modal-botoes">
          <button className="modal-cancelar" onClick={onCancelar}>Cancelar</button>
          <button className="modal-confirmar" onClick={onConfirmar}>Confirmar</button>
        </div>
      </div>
    </div>
  )
}

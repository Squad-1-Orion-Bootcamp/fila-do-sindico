import { Building2 } from 'lucide-react'

// Marca no alto da caixa do login e dos cadastros.
export function MarcaCaixa() {
  return (
    <div className="topo-marca caixa-marca">
      <span className="topo-marca-icone">
        <Building2 size={20} aria-hidden />
      </span>
      Fila do Síndico
    </div>
  )
}

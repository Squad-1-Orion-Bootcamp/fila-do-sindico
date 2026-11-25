import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole } from './auth/RequireRole'
import { Login } from './pages/Login'

// Cada página carrega só quando a rota é aberta (SQUAD1-83). O login fica no pacote inicial,
// porque é a primeira tela de quase todo mundo.
const CadastroGestor = lazy(() =>
  import('./pages/CadastroGestor').then((m) => ({ default: m.CadastroGestor })),
)
const CadastroMorador = lazy(() =>
  import('./pages/CadastroMorador').then((m) => ({ default: m.CadastroMorador })),
)
const Condominios = lazy(() =>
  import('./pages/Condominios').then((m) => ({ default: m.Condominios })),
)
const MinhasOcorrencias = lazy(() =>
  import('./pages/MinhasOcorrencias').then((m) => ({ default: m.MinhasOcorrencias })),
)
const QuadroOcorrencias = lazy(() =>
  import('./pages/Placeholders').then((m) => ({ default: m.QuadroOcorrencias })),
)
const SemAcesso = lazy(() =>
  import('./pages/Placeholders').then((m) => ({ default: m.SemAcesso })),
)
const TarefaPublica = lazy(() =>
  import('./pages/TarefaPublica').then((m) => ({ default: m.TarefaPublica })),
)

export default function App() {
  return (
    <Suspense fallback={<p className="estado-vazio">Carregando…</p>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro-gestor" element={<CadastroGestor />} />
        <Route path="/cadastro" element={<CadastroMorador />} />
        <Route path="/sem-acesso" element={<SemAcesso />} />
        {/* Link do WhatsApp para o funcionário (SQUAD1-77): sem login, o acesso vem do token */}
        <Route path="/tarefa/:token" element={<TarefaPublica />} />
        <Route
          path="/quadro"
          element={
            <RequireRole role="gestor">
              <QuadroOcorrencias />
            </RequireRole>
          }
        />
        <Route
          path="/condominios"
          element={
            <RequireRole role="gestor">
              <Condominios />
            </RequireRole>
          }
        />
        <Route
          path="/minhas-ocorrencias"
          element={
            <RequireRole role="morador">
              <MinhasOcorrencias />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

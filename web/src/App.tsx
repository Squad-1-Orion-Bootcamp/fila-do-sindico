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
const Funcionarios = lazy(() =>
  import('./pages/Funcionarios').then((m) => ({ default: m.Funcionarios })),
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

export default function App() {
  return (
    <Suspense fallback={<p className="estado-vazio">Carregando…</p>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro-gestor" element={<CadastroGestor />} />
        <Route path="/cadastro" element={<CadastroMorador />} />
        <Route path="/sem-acesso" element={<SemAcesso />} />
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
          path="/funcionarios"
          element={
            <RequireRole role="gestor">
              <Funcionarios />
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

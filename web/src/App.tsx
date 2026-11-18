import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole } from './auth/RequireRole'
import { CadastroGestor } from './pages/CadastroGestor'
import { Login } from './pages/Login'
import { MinhasOcorrencias, QuadroOcorrencias, SemAcesso } from './pages/Placeholders'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro-gestor" element={<CadastroGestor />} />
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
        path="/minhas-ocorrencias"
        element={
          <RequireRole role="morador">
            <MinhasOcorrencias />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

import { Route, Routes } from "react-router-dom"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Registro from "./pages/Registro"
import Dashboard from "./pages/Dashboard"
import PuntosControl from "./pages/PuntosControl"
import Alertas from "./pages/Alertas"
import OlvidePassword from "./pages/OlvidePassword"
import ResetPassword from "./pages/ResetPassword"

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/puntos-control" element={<PuntosControl />} />
      <Route path="/alertas" element={<Alertas />} />
      <Route path="/olvide-password" element={<OlvidePassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
    </Routes>
  )
}

export default App

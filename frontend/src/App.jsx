import Header from './components/Header'
import Hero from './components/Hero'
import Problema from './components/Problema'
import Solucion from './components/Solucion'
import Beneficios from './components/Beneficios'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen font-sans text-mg-navy-900">
      <Header />
      <Hero />
      <Problema />
      <Solucion />
      <Beneficios />
      <Footer />
    </div>
  )
}

export default App

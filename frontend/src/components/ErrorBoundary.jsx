import { Component } from "react"

class ErrorBoundary extends Component {
  state = { tieneError: false }

  static getDerivedStateFromError() {
    return { tieneError: true }
  }

  componentDidCatch(error, info) {
    console.error("Error capturado por ErrorBoundary:", error, info)
  }

  render() {
    if (this.state.tieneError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-2xl border border-mg-danger-500/30 bg-mg-danger-500/10 p-6 text-center text-sm font-medium text-mg-danger-500">
            Ocurrió un error inesperado al mostrar este contenido.
          </div>
        )
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

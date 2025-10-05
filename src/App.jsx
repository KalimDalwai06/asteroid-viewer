import ThreeDOrbitViewer from "./components/ThreeDOrbitViewer";
import ImpactMapViewer from "./components/ImpactMapViewer";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <header className="py-20 px-4 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
          Interactive Visual Hub
        </h1>
        <p className="text-slate-300 text-lg md:text-xl max-w-3xl mx-auto">
          Explore real-time visualizations, simulations, and interactive models to understand the asteroid threat and mitigation strategies.
        </p>
      </header>

      {/* 3D Orbit Viewer Section */}
      <ThreeDOrbitViewer />

      {/* Impact Map Section */}
      <ImpactMapViewer />

      {/* Footer */}
      <footer className="py-12 px-4 text-center text-slate-400 text-sm">
        <p>© 2025 Asteroid Tracking System. Data provided by NASA JPL.</p>
      </footer>
    </div>
  );
}

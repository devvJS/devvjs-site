import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import LoadingScreen from './components/LoadingScreen'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Resume from './pages/Resume'

function App() {
  const [loading, setLoading] = useState(true)

  return (
    <div id="top" className="min-h-screen text-text-primary font-sans overflow-x-hidden">
      {loading && <LoadingScreen onComplete={() => setLoading(false)} />}
      <Navbar />
      <main className="pt-14">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/resume" element={<Resume />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App

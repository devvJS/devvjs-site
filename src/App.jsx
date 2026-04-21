import { useState } from 'react'
import LoadingScreen from './components/LoadingScreen'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Hero from './sections/Hero'
import About from './sections/About'
import Skills from './sections/Skills'
import Projects from './sections/Projects'
import Contact from './sections/Contact'

function App() {
    const [loading, setLoading] = useState(true)

  return (
    <div id="top" className="min-h-screen text-text-primary font-sans overflow-x-hidden">
      {loading && <LoadingScreen onComplete={() => setLoading(false)} />}
      <Navbar />
      <main className="pt-14">
        <Hero />
        <About />
        <Skills />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}

export default App
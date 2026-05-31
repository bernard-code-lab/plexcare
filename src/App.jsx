import Nav from './components/Nav'
import Hero from './components/Hero'
import LogoMarquee from './components/LogoMarquee'
import Problem from './components/Problem'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import Integrations from './components/Integrations'
import Testimonial from './components/Testimonial'
import Pricing from './components/Pricing'
import FAQ from './components/FAQ'
import CTA from './components/CTA'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <a
        href="#recursos"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-teal-400 focus:px-4 focus:py-2 focus:text-ink-950"
      >
        Pular para o conteúdo
      </a>
      <Nav />
      <main>
        <Hero />
        <LogoMarquee />
        <Problem />
        <Features />
        <HowItWorks />
        <Integrations />
        <Testimonial />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  )
}

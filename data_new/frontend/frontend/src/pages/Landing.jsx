import Navbar from "../components/Landing/Navbar";
import Hero from "../components/Landing/Hero";
import About from "../components/Landing/About";
import Features from "../components/Landing/Features";
import HowItWorks from "../components/Landing/HowItWorks";
import Showcase from "../components/Landing/Showcase";
import Stats from "../components/Landing/Stats";
import CTA from "../components/Landing/CTA";
import Footer from "../components/Landing/Footer";
import "../styles/landing.css";

export default function Landing() {
    return (
        <>
            <Navbar />
            <main>
                <Hero />
                <About />
                <Features />
                <HowItWorks />
                <Showcase />
                <Stats />
                <CTA />
            </main>
            <Footer />
        </>
    );
}

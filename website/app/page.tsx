import { Navbar } from "@/components/navigation/Navbar";
import { Hero } from "@/components/sections/Hero";
import { ThreeModes } from "@/components/sections/ThreeModes";
import { Features } from "@/components/sections/Features";
import { Values } from "@/components/sections/Values";
import { Pricing } from "@/components/sections/Pricing";
import { DownloadCTA } from "@/components/sections/DownloadCTA";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-navy-950">
      <Navbar />
      <Hero />
      <ThreeModes />
      <Features />
      <Values />
      <Pricing />
      <DownloadCTA />
      <Footer />
    </main>
  );
}

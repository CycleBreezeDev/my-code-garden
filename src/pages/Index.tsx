import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import LiveJackpotsSection from "@/components/LiveJackpotsSection";
import GroupTicketSection from "@/components/GroupTicketSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import TransparencySection from "@/components/TransparencySection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <LiveJackpotsSection />
      <GroupTicketSection />
      <HowItWorksSection />
      <TransparencySection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;

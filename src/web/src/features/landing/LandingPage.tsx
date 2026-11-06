import { CallToAction } from "./CallToAction";
import { CompareSection } from "./CompareSection";
import { FactsSection } from "./FactsSection";
import { FaqSection } from "./FaqSection";
import { FeatureMarquee } from "./FeatureMarquee";
import { FeaturesSection } from "./FeaturesSection";
import { LandingFooter } from "./LandingFooter";
import { LandingHero } from "./LandingHero";
import { PhasesSection } from "./PhasesSection";
import { RolesSection } from "./RolesSection";

export function LandingPage() {
  return (
    <div className="min-h-svh">
      <LandingHero />
      <FeatureMarquee />
      <main>
        <FactsSection />
        <PhasesSection />
        <CompareSection />
        <FeaturesSection />
        <RolesSection />
        <FaqSection />
        <CallToAction />
      </main>
      <LandingFooter />
    </div>
  );
}

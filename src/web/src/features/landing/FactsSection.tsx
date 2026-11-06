import { facts } from "./landingContent";
import { Wrap } from "./parts";

export function FactsSection() {
  return (
    <section className="pt-12 pb-2">
      <Wrap className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-5 text-center">
        {facts.map((fact) => (
          <div key={fact.label}>
            <b className="block text-[40px]/[1.15] font-extrabold tracking-[-0.03em]">{fact.value}</b>
            <span className="text-sm text-muted-foreground">{fact.label}</span>
          </div>
        ))}
      </Wrap>
    </section>
  );
}

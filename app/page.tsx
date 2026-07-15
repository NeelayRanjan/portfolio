import { EnergyHero } from "@/components/EnergyHero";
import { DiffusionVisualizer } from "@/components/DiffusionVisualizer";
import { DrawDigit } from "@/components/DrawDigit";
import { ChessPanel } from "@/components/ChessPanel";
import { SampleSpace } from "@/components/SampleSpace";
import { SampleSpaceWriteup } from "@/components/SampleSpaceWriteup";
import { Section } from "@/components/Section";

export default function Home() {
  return (
    <main className="flex-1">
      <EnergyHero />

      <div className="mx-auto w-full max-w-5xl px-6">
        {/* Terminal sections carry their own heading and lede inside the panel,
            after the boot log — so no title/lede here.

            No swarm stations down here on purpose: the swarm is the hero and
            nothing else. Section labels made it a full-page background that
            never stopped moving, which read as noise on a phone. The `label`
            props below are real text that resolves out of noise once, then
            sits still. */}
        <Section id="diffusion" glyphSeed={2} label="x0 diffusion">
          <DiffusionVisualizer />
        </Section>

        <Section id="draw" glyphSeed={5} label="draw a digit">
          <DrawDigit />
        </Section>

        <Section id="chess" glyphSeed={7} label="play the engine">
          <ChessPanel />
        </Section>

        <Section id="sample-space" glyphSeed={3} label="sample space">
          <SampleSpace />
          {/* Spec: the write-up sits directly beneath the panel. */}
          <SampleSpaceWriteup />
        </Section>
      </div>
    </main>
  );
}

import JudgeWalkthrough from "@/components/JudgeWalkthrough";
import ArrowIcon from "@/components/ArrowIcon";
import SampleComparison from "@/components/SampleComparison";
import { demoEvaluation as evaluation } from "@/lib/demo";

export default function Home() {
  return (
    <main id="main-content" className="home-wrap">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow"><span className="status-dot" aria-hidden="true" /> Evidence first. People in control.</p>
          <h1 id="home-title">A fairer end<br />to your <em>tenancy.</em></h1>
          <p className="hero-description">A deposit deduction deserves a closer look. Compare move-in and move-out evidence, question the model, and build a response you can stand behind.</p>
          <div className="home-actions"><a className="btn" href="/demo">Try the sample review</a><a className="text-link" href="/upload">How it works</a></div>
          <p className="hero-reassurance">No sign-up. No personal files. Nothing sent.</p>
          <div className="hero-principle"><span aria-hidden="true"><ArrowIcon direction="turn" /></span><p>AI helps surface the changes.<br /><strong>You decide what they mean.</strong></p></div>
        </div>
        <SampleComparison />
      </section>

      <aside className="provenance-strip" aria-label="Sample provenance">
        <span className="provenance-symbol" aria-hidden="true">i</span>
        <div><strong>Generated test images · Real model results.</strong><p>Muse Image created the test scenes; SAM 3.1 and Muse Spark analysed them beforehand in an offline run. No live model calls or analysis of your videos happen here.</p></div>
        <span className="prototype-label">Working prototype</span>
      </aside>

      <JudgeWalkthrough />

      <section className="home-process" aria-labelledby="process-title">
        <div className="section-heading"><p className="eyebrow">From a change to a considered response</p><h2 id="process-title">Less guesswork.<br /><em>More to go on.</em></h2></div>
        <div className="process-grid">
          <article><span className="step-number">01 / Compare</span><h3>See the evidence.</h3><p>View both visits side by side. Enlarge the item crops and check what is actually visible.</p></article>
          <article><span className="step-number">02 / Question</span><h3>Challenge the suggestion.</h3><p>Inspect the model’s reasoning and disagreements with planted test intent. Choose Discuss after evidence, Dispute, or Not claimed for each finding.</p></article>
          <article><span className="step-number">03 / Respond</span><h3>Make the draft yours.</h3><p>Prepare a response from your choices. Review and export it locally. No charge is automatically accepted.</p></article>
        </div>
      </section>

      <section className="honesty-panel" aria-labelledby="honesty-title">
        <div><p className="eyebrow">An honest look at the model</p><h2 id="honesty-title">Useful does not<br />mean <em>infallible.</em></h2><p>We publish the misses, not just the successes. This small generated test is a demonstration of the workflow, not a real-world accuracy claim.</p><a className="text-link" href="/demo#sample-evaluation">Inspect the published evaluation <ArrowIcon /></a></div>
        <div className="home-metrics">
          <div><strong>{evaluation.detected}<span>/{evaluation.planted}</span></strong><span>Planted changes detected</span></div>
          <div><strong>{evaluation.exactVerdict}<span>/{evaluation.planted}</span></strong><span>Exact model verdicts</span></div>
          <p>Including a carpet planted as fair wear but labelled damage, and a sealant change with no saved finding. Your review is part of the process.</p>
        </div>
      </section>
      <section className="home-final"><p className="eyebrow">Your evidence. Your judgement.</p><h2>Take a closer look.</h2><a className="btn" href="/demo">Open the sample review <ArrowIcon /></a><p>Prototype for UK rental deposit evidence. Not legal advice or a determination of responsibility.</p></section>
    </main>
  );
}

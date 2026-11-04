"use client";

import ArrowIcon from "@/components/ArrowIcon";
import { useState } from "react";
import Board from "@/components/Board";
import DemoEvaluation from "@/components/DemoEvaluation";
import { demoData, demoFindings } from "@/lib/demo";

const STAGES = [
  { title: "Sample walkthrough frames", description: "Select clear frames from each visit to provide comparison evidence." },
  { title: "Segment and match items", description: "Locate items and look for corresponding views across move-in and move-out." },
  { title: "Suggest changes for review", description: "Generate tentative classifications. These can include misses and incorrect suggestions." },
  { title: "Review evidence and choose a response", description: "Inspect each image, review the suggestion, and decide what belongs in your draft reply." },
];

export default function Upload() {
  const [showSample, setShowSample] = useState(false);

  return (
    <main id="main-content" className="wrap workflow-page">
      <div className="page-heading"><div><p className="eyebrow">Behind the comparison</p><h1>Explore a sample comparison</h1><p>From two visits to a response you can review.</p></div><a className="text-link" href="/demo">Go to the findings <ArrowIcon /></a></div>
      <div className="banner">Generated test images · Real model results. Muse Image created the test scenes; SAM 3.1 and Muse Spark analysed them beforehand in an offline run. No live model calls happen here. No personal videos are requested or analysed.</div>
      <section className="workflow-section" aria-labelledby="sample-workflow-title">
        <h2 id="sample-workflow-title">How a comparison is structured</h2>
        <p>These stages explain the workflow. They are illustrative, not a live analysis or progress indicator.</p>
        <ol className="workflow-steps">
          {STAGES.map(({ title, description }, index) => (
            <li key={title}><span className="step-number" aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>
          ))}
        </ol>
      </section>
      <button
        type="button"
        className="btn"
        aria-expanded={showSample}
        aria-controls="sample-results"
        onClick={() => setShowSample((shown) => !shown)}
      >
        {showSample ? "Hide sample findings" : "Show sample findings"}
      </button>
      <div id="sample-results" hidden={!showSample} style={{ marginTop: 24 }}>
            <h2>Sample findings</h2>
            <DemoEvaluation />
            <Board
              rememberSampleResponses
              property={demoData.property}
              findings={demoFindings}
              pdf="/demo/fair-wear-evidence-pack.pdf"
              banner="Real model results: SAM 3.1 segmentation and Muse Spark classifications on Muse Image-generated test scenes. The models ran beforehand; no live model calls happen here. These findings are not an analysis of your property or files. Review each suggestion against its evidence."
            />
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <main className="wrap">
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>Fair Wear</h1>
      <p style={{ fontSize: 20, lineHeight: 1.5 }}>Compare move-in and move-out evidence, review possible changes, and prepare a draft response about rental deposit deductions.</p>
      <div className="banner">Generated test images · Real model results. Muse Image created the test scenes; SAM 3.1 and Muse Spark analysed them beforehand in an offline run. No live model calls or analysis of your videos happen here.</div>
      <p><a className="btn" href="/upload">Explore sample comparison</a>{" "}<a href="/demo" style={{ marginLeft: 12 }}>Go straight to sample findings</a></p>
      <h2>What the prototype explores</h2>
      <ol style={{ lineHeight: 1.8 }}>
        <li>Compare walkthrough frames from two visits to the same rooms.</li>
        <li>Use segmentation and matching to identify possible item changes.</li>
        <li>Review suggested classifications, supporting images, and known errors.</li>
        <li>Choose a response for each finding before preparing a draft reply.</li>
      </ol>
      <p>Model suggestions can be wrong or miss changes. A finding is not proof of liability, and any proposed deduction needs supporting evidence and review.</p>
      <p style={{ opacity: 0.6 }}>Built for the Meta Global AI Developer Hackathon. Work in progress.</p>
    </main>
  );
}

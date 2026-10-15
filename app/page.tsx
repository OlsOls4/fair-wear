export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px" }}>
      <h1 style={{ fontSize: 44, marginBottom: 8 }}>Fair Wear</h1>
      <p style={{ fontSize: 20, lineHeight: 1.5 }}>Film your rental at move-in and move-out. Fair Wear finds every change, separates fair wear and tear from damage, and writes your deposit-dispute evidence pack.</p>
      <ol style={{ lineHeight: 1.8 }}>
        <li>Upload two walkthrough videos (one per visit, room by room).</li>
        <li>SAM 3.1 segments and tracks each item; we match it across visits.</li>
        <li>Muse Spark judges each change against UK deposit-scheme guidance.</li>
        <li>Download a dated evidence pack and a draft reply to your landlord.</li>
      </ol>
      <p style={{ opacity: 0.6 }}>Built for the Meta Global AI Developer Hackathon. Work in progress.</p>
    </main>
  );
}

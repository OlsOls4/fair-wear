export default function Home() {
  return (
    <main className="wrap">
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>Fair Wear</h1>
      <p style={{ fontSize: 20, lineHeight: 1.5 }}>Film your rental at move-in and move-out. Fair Wear finds every change, separates fair wear and tear from damage, and writes your deposit-dispute evidence pack.</p>
      <p><a className="btn" href="/upload">Start a comparison</a>{" "}<a href="/demo" style={{ marginLeft: 12 }}>See a sample findings board</a></p>
      <ol style={{ lineHeight: 1.8 }}>
        <li>Upload two walkthrough videos (one per visit, room by room).</li>
        <li>SAM 3.1 segments and tracks each item; we match it across visits.</li>
        <li>Muse Spark judges each change against UK deposit-scheme guidance; the apportionment maths is deterministic.</li>
        <li>Download a dated evidence pack and a draft reply to your landlord.</li>
      </ol>
      <p style={{ opacity: 0.6 }}>Built for the Meta Global AI Developer Hackathon. Work in progress.</p>
    </main>
  );
}

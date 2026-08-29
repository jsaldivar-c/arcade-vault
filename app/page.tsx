export default function Home() {
  return (
    <section className="av-hero">
      <h1 className="flicker">ARCADE VAULT</h1>
      <p className="sub">
        <span className="neon-yellow">INSERT COIN</span>{" "}
        <span className="blink">_</span>
      </p>
      <div className="av-filters" style={{ justifyContent: "center" }}>
        <button className="btn pulse">JUGAR</button>
        <button className="btn magenta">SALÓN DE LA FAMA</button>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { GardenCollection } from "./garden-collection";
import "./garden.css";

export const metadata: Metadata = {
  title: "Garden",
  description: "Where learning takes root.",
};

const beds = [
  { name: "Psychology", icon: "🧠", tagline: "Understanding people, one question at a time.", description: "记录心理学课程、概念整理、研究思考和复习内容。" },
  { name: "AI", icon: "🤖", tagline: "Exploring what changes when machines begin to assist thought.", description: "记录 AI 工具、提示词、学习辅助和创作实践。" },
  { name: "Coding", icon: "💻", tagline: "Learning to turn ideas into things that work.", description: "记录 Python、网页制作和基础技术学习。" },
  { name: "Design & Making", icon: "🎨", tagline: "Making ideas easier to see, read and experience.", description: "记录 PPT、文档、网页视觉和创意表达练习。" },
] as const;

export default function GardenPage() {
  return (
    <main id="main-content" tabIndex={-1} className="garden-page">
      <section className="garden-entrance" aria-labelledby="garden-title">
        <div className="garden-entrance-copy">
          <p className="eyebrow">A place for growing knowledge</p>
          <h1 id="garden-title">Garden</h1>
          <p className="garden-lead">Where learning takes root.</p>
          <p>这里记录正在学习、练习和持续成长的内容。</p>
          <div className="garden-entrance-note">
            <p>Some seeds grow quickly. Others need more time.</p>
            <p>有些种子长得很快，有些需要更多时间。</p>
          </div>
        </div>
        <div className="garden-landscape" aria-hidden="true"><span /><span /><span /><i /><b /></div>
      </section>

      <section className="garden-section" aria-labelledby="beds-title">
        <header className="garden-heading">
          <p className="eyebrow">Four places to begin</p>
          <h2 id="beds-title">Growing Beds</h2>
          <p className="garden-section-lead">Different ideas need different soil.</p>
          <p className="garden-description">不同的想法，需要不同的生长环境。</p>
        </header>
        <div className="bed-grid">
          {beds.map((bed, index) => (
            <article className="bed-card card" key={bed.name}>
              <span className="bed-number">0{index + 1}</span>
              <span className="bed-icon" aria-hidden="true">{bed.icon}</span>
              <h3>{bed.name}</h3>
              <p className="bed-tagline">{bed.tagline}</p>
              <p>{bed.description}</p>
            </article>
          ))}
        </div>
      </section>

      <GardenCollection beds={beds.map((bed) => bed.name)} />

      <section className="garden-ending" aria-labelledby="garden-ending-title">
        <div className="garden-ending-mark" aria-hidden="true">↝</div>
        <h2 id="garden-ending-title">Growth is rarely a straight line.</h2>
        <p>成长很少是一条直线。</p>
        <nav className="garden-ending-actions" aria-label="Continue exploring">
          <Link className="button button-primary" href="/forest">Follow a question into the Forest →</Link>
          <Link className="button button-secondary" href="/ruins">See what stopped growing →</Link>
        </nav>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { LakeExperience } from "./lake-experience";
import "./lake.css";

export const metadata: Metadata = {
  title: "Lake",
  description: "Things worth reflecting on.",
};

export default function LakePage() {
  return (
    <main id="main-content" tabIndex={-1} className="lake-page">
      <section className="lake-entrance" aria-labelledby="lake-title">
        <div className="lake-entrance-copy">
          <p className="eyebrow">A place for quiet attention</p>
          <h1 id="lake-title">Lake</h1>
          <p className="lake-lead">Things worth reflecting on.</p>
          <p>这里收藏那些曾让我停下来观看、聆听或思考的东西。</p>
          <div className="lake-entrance-note">
            <p>Some things stay because they changed me. Others stay because I am not finished with them yet.</p>
            <p>有些东西留下，是因为它改变了我。另一些留下，是因为我还没有想完。</p>
          </div>
          <Link className="lake-home-link" href="/">← Home</Link>
        </div>
        <div className="lake-water" aria-hidden="true">
          <span /><span /><span />
          <i />
        </div>
      </section>

      <LakeExperience />

      <section className="lake-ending" aria-labelledby="lake-ending-title">
        <div className="lake-ending-mark" aria-hidden="true">◌</div>
        <h2 id="lake-ending-title">The lake keeps what once mattered.</h2>
        <p>湖水保存那些曾经重要过的东西。</p>
      </section>
    </main>
  );
}

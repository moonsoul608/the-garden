"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components";
import type { PublicContentPresentation } from "@/lib/content/public-presentation";

const trails = [
  { name: "Mind & Behavior", icon: "🧠", tagline: "Questions about how people think, feel and act.", description: "关于心理、行为、记忆、情绪与人的问题。" },
  { name: "Humans & AI", icon: "🤖", tagline: "Questions that appear when humans begin thinking with machines.", description: "关于人工智能、理解、创造和人与技术关系的问题。" },
  { name: "Design & Experience", icon: "🎨", tagline: "Questions about what makes an experience clear, useful or worth exploring.", description: "关于设计、交互、表达和用户体验的问题。" },
  { name: "Stories & Memory", icon: "✍️", tagline: "Questions carried by stories, memory and forgetting.", description: "关于写作、故事、记忆和遗忘的问题。" },
] as const;

export function ForestExperience({ items }: { items: PublicContentPresentation[] }) {
  const [activeTrail, setActiveTrail] = useState("All");
  const [foundIndex, setFoundIndex] = useState<number | null>(null);
  const collectionRef = useRef<HTMLElement>(null);

  const visibleItems = useMemo(
    () => items.filter((item) => activeTrail === "All" || item.primaryCategories.includes(activeTrail)),
    [activeTrail, items],
  );
  const foundQuestion = foundIndex === null ? null : items[foundIndex];

  function chooseTrail(trail: string) {
    setActiveTrail(trail);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => collectionRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }));
  }

  function findQuestion() {
    setFoundIndex(Math.floor(Math.random() * items.length));
  }

  return (
    <>
      <section className="forest-section trails-section" aria-labelledby="trails-title">
        <header className="forest-heading">
          <h2 id="trails-title">Trails of Thought</h2>
          <p className="forest-section-lead">Some questions lead deeper than others.</p>
          <p className="forest-description">有些问题，会把人带到更深的地方。</p>
        </header>
        <div className="trail-list" aria-label="Forest trails">
          {trails.map((trail, index) => (
            <button className="trail-sign" type="button" key={trail.name} onClick={() => chooseTrail(trail.name)} aria-pressed={activeTrail === trail.name}>
              <span className="trail-number" aria-hidden="true">0{index + 1}</span>
              <span className="trail-icon" aria-hidden="true">{trail.icon}</span>
              <span className="trail-copy"><strong>{trail.name}</strong><small>{trail.tagline}</small><span>{trail.description}</span></span>
              <span className="trail-state">{activeTrail === trail.name ? "Selected trail" : "Follow trail"} →</span>
            </button>
          ))}
        </div>
      </section>

      <section className="forest-section question-collection" aria-labelledby="questions-title" ref={collectionRef}>
        <div className="trail-filters" role="group" aria-label="Filter Questions by Trail">
          {["All", ...trails.map((trail) => trail.name)].map((trail) => (
            <button className="trail-filter" type="button" key={trail} aria-pressed={activeTrail === trail} onClick={() => setActiveTrail(trail)}>
              <span aria-hidden="true">{activeTrail === trail ? "✓" : "⌁"}</span> {trail}
            </button>
          ))}
        </div>
        <header className="forest-heading collection-heading">
          <div>
            <h2 id="questions-title">Questions growing here</h2>
            <p className="forest-section-lead">Thoughts do not always grow in straight lines.</p>
            <p className="forest-description">思考并不总是沿着直线生长。</p>
          </div>
          <p className="question-count" aria-live="polite">{visibleItems.length} {visibleItems.length === 1 ? "Question" : "Questions"}</p>
        </header>

        {visibleItems.length ? (
          <div className="question-grid">
            {visibleItems.map((item) => (
              <Link className="question-card card" href={`/forest/${item.slug}`} key={item.id}>
                <div className="question-card-top"><span>Question</span>{item.status && <StatusBadge status={item.status} />}</div>
                <h3>{item.title}</h3>
                <p className="question-summary">{item.summary}</p>
                <ul aria-label="Trails">{item.primaryCategories.map((trail) => <li key={trail}>{trail}</li>)}</ul>
                <span className="question-cta">{item.cta}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="forest-empty card" role="status">
            <span aria-hidden="true">⌁</span>
            <h3>No question is waiting on this trail yet.</h3>
            <p>Try another path through the Forest.</p>
            <button className="button button-secondary" type="button" onClick={() => setActiveTrail("All")}>Show all trails</button>
          </div>
        )}
      </section>

      <section className="found-section" aria-labelledby="found-title">
        <div className="found-inner">
          <header className="forest-heading">
            <h2 id="found-title">A question found you</h2>
            <p className="forest-section-lead">Perhaps you were looking for each other.</p>
            <p className="forest-description">也许你们刚好在寻找彼此。</p>
          </header>
          <div className="found-result" aria-live="polite">
            {foundQuestion ? (
              <article className="found-card card">
                <div className="question-card-top"><span>Question found</span>{foundQuestion.status && <StatusBadge status={foundQuestion.status} />}</div>
                <h3>{foundQuestion.title}</h3>
                <p>{foundQuestion.summary}</p>
                <ul aria-label="Trails">{foundQuestion.primaryCategories.map((trail) => <li key={trail}>{trail}</li>)}</ul>
                <div className="found-actions">
                  <Link className="button button-primary" href={`/forest/${foundQuestion.slug}`}>Follow this question</Link>
                  <button className="button button-secondary" type="button" onClick={findQuestion}>Find another question</button>
                  <Link className="button button-secondary" href={`/greenhouse?idea=${encodeURIComponent(foundQuestion.title)}`}>Grow it in the Greenhouse</Link>
                </div>
              </article>
            ) : (
              <button className="button button-primary find-button" type="button" onClick={findQuestion}>Let a question find me</button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

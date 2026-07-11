"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { MAX_IDEA_LENGTH, type SeedGardenerResponse, type SeedResult } from "@/types/seed";

const sampleInputs = [
  "我想开始学习心理学，但不知道先学什么。",
  "我有一个故事想法，但还不知道主角是谁。",
  "我想用 AI 做一个小工具，但没有具体方向。",
];

const sampleCards = [
  { name: "Learning", text: "我想学习一个新领域，但不知道怎样开始。", icon: "◌" },
  { name: "Creating", text: "我有一个故事或作品想法，但它还很模糊。", icon: "✦" },
  { name: "Building", text: "我想做一个小工具，但不知道它应该解决什么问题。", icon: "◇" },
];

type ViewState = "empty" | "editing" | "loading" | "success" | "error";

function formatSeed(seed: SeedResult) {
  return [
    `Seed name: ${seed.seedName}`,
    `Core question: ${seed.coreQuestion}`,
    `Suggested Region: ${seed.suggestedRegion}`,
    `Growth stage: ${seed.growthStage}`,
    "Paths to explore:",
    ...seed.pathsToExplore.map((path, index) => `${index + 1}. ${path}`),
    `First step: ${seed.firstStep}`,
  ].join("\n");
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function GreenhouseExperience({ initialIdea }: { initialIdea: string }) {
  const [idea, setIdea] = useState(initialIdea);
  const [state, setState] = useState<ViewState>(initialIdea ? "editing" : "empty");
  const [seed, setSeed] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [showForestPrefill, setShowForestPrefill] = useState(Boolean(initialIdea));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputSectionRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  function focusInput(scroll = false) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (scroll) inputSectionRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function chooseIdea(value: string) {
    setIdea(value);
    setError(null);
    setMessage("");
    setCopyStatus("");
    setShowForestPrefill(false);
    setState("editing");
    focusInput(true);
  }

  async function growIdea(value = idea) {
    const trimmedIdea = value.trim();
    setError(null);
    setCopyStatus("");
    if (!trimmedIdea) {
      setState("empty");
      setMessage("Plant something first. Even a small thought is enough.");
      focusInput();
      return;
    }
    if (trimmedIdea.length > MAX_IDEA_LENGTH) {
      setState("editing");
      setMessage(`Please keep your idea under ${MAX_IDEA_LENGTH} characters.`);
      focusInput();
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setMessage("");
    setState("loading");

    try {
      const response = await fetch("/api/seed-gardener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: trimmedIdea }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as SeedGardenerResponse;
      if (!response.ok || !payload.ok) throw new Error("request failed");
      if (abortRef.current !== controller) return;
      setSeed(payload.seed);
      setError(null);
      setState("success");
      setMessage("Your Seed is ready.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (abortRef.current !== controller) return;
      setError("This seed could not grow right now.");
      setState("error");
      setMessage("");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "loading") return;
    void growIdea();
  }

  async function handleCopySeed() {
    if (!seed) return;
    try {
      await copyText(formatSeed(seed));
      setCopyStatus("Seed copied.");
    } catch {
      setCopyStatus("The Seed could not be copied.");
    }
  }

  async function handleCopyIdea() {
    try {
      await copyText(idea);
      setCopyStatus("Your original idea was copied.");
    } catch {
      setCopyStatus("Your idea could not be copied.");
    }
  }

  function editIdea() {
    setState("editing");
    setError(null);
    setMessage("");
    setCopyStatus("");
    focusInput(true);
  }

  function reset() {
    abortRef.current?.abort();
    setIdea("");
    setSeed(null);
    setError(null);
    setState("empty");
    setMessage("");
    setCopyStatus("");
    setShowForestPrefill(false);
    focusInput(true);
  }

  return (
    <main id="main-content" tabIndex={-1} className="greenhouse-page">
      <section className="greenhouse-hero" aria-labelledby="greenhouse-title">
        <div className="greenhouse-hero-copy">
          <p className="eyebrow">A place for beginnings</p>
          <h1 id="greenhouse-title">Greenhouse</h1>
          <p className="tagline">Give an idea somewhere to grow.</p>
          <p>在这里借助 AI，把一个模糊的想法培育成可以继续探索的 Seed。</p>
          <div className="greenhouse-hero-note">
            <strong>You do not need a complete idea to begin.</strong>
            <span>开始时，你不需要拥有一个完整的想法。</span>
          </div>
        </div>
        <div className="greenhouse-window" aria-hidden="true">
          <span className="window-sun" />
          <span className="window-shelf" />
          <span className="window-pot window-pot-one"><i /></span>
          <span className="window-pot window-pot-two"><i /></span>
          <span className="window-pot window-pot-three"><i /></span>
        </div>
      </section>

      <section className="greenhouse-workbench" ref={inputSectionRef} aria-labelledby="plant-title">
        <div className="workbench-copy">
          <p className="eyebrow">Seed Gardener</p>
          <h2 id="plant-title">Plant an idea</h2>
          <p className="section-tagline">Start with a question, an interest, or even half a thought.</p>
          <p>写下一个问题、一项兴趣，或者一个还没有想清楚的念头。</p>
          <div className="gardener-guidance">
            <strong>The Seed Gardener offers directions, not final answers.</strong>
            <span>Seed Gardener 提供的是方向，而不是最终答案。</span>
          </div>
        </div>

        <form className="plant-form card" onSubmit={handleSubmit} noValidate>
          {showForestPrefill && <p className="forest-prefill">A question arrived from the Forest.</p>}
          <label htmlFor="greenhouse-idea">What would you like to grow?</label>
          <textarea
            ref={textareaRef}
            id="greenhouse-idea"
            value={idea}
            maxLength={MAX_IDEA_LENGTH}
            rows={7}
            disabled={state === "loading"}
            aria-describedby="idea-helper idea-count"
            onChange={(event) => {
              setIdea(event.target.value);
              setError(null);
              setMessage("");
              setCopyStatus("");
              if (state !== "success") setState(event.target.value ? "editing" : "empty");
            }}
          />
          <div className="input-meta">
            <span id="idea-helper">例如：我想学习心理学，但不知道从哪里开始。</span>
            <span id="idea-count">{idea.length}/{MAX_IDEA_LENGTH}</span>
          </div>
          <button className="button button-primary grow-button" type="submit" aria-disabled={state === "loading"}>
            {state === "loading" ? "Tending your idea…" : "Grow this idea"}
          </button>
          <div className="sample-chips" aria-label="Sample inputs">
            {sampleInputs.map((sample) => (
              <button key={sample} type="button" disabled={state === "loading"} onClick={() => chooseIdea(sample)}>
                {sample}
              </button>
            ))}
          </div>
        </form>
      </section>

      <section className="seed-result-section" aria-labelledby="result-title">
        <div className="result-heading">
          <p className="eyebrow">What may grow</p>
          <h2 id="result-title">Your Seed</h2>
          <p className="section-tagline">Here is one way this idea could begin to grow.</p>
        </div>

        <div className="result-live" aria-live="polite" aria-atomic="true">
          {state === "loading" && (
            <div className="seed-state card" role="status">
              <span className="sprout-loader" aria-hidden="true"><i /><i /></span>
              <p>The Seed Gardener is tending your idea…</p>
            </div>
          )}

          {(state === "empty" || state === "editing") && !seed && (
            <div className="seed-state seed-empty card">
              <span aria-hidden="true">🌰</span>
              <p>Plant something first. Even a small thought is enough.</p>
            </div>
          )}

          {state === "error" && error && (
            <div className="seed-state seed-error card" role="alert">
              <span aria-hidden="true">△</span>
              <h3>This seed could not grow right now.</h3>
              <p>你可以稍后再试，或先保留刚才写下的想法。</p>
              <div className="result-actions">
                <button className="button button-primary" type="button" onClick={() => void growIdea()}>Try again</button>
                <button className="button button-secondary" type="button" onClick={() => void handleCopyIdea()}>Copy my original idea</button>
              </div>
            </div>
          )}

          {seed && state === "success" && !error && (
            <article className="seed-card card">
              <header>
                <p>Seed name</p>
                <h3>{seed.seedName}</h3>
              </header>
              <dl className="seed-details">
                <div className="seed-detail-wide"><dt>Core question</dt><dd>{seed.coreQuestion}</dd></div>
                <div><dt>Suggested Region</dt><dd><span className="seed-pill">{seed.suggestedRegion}</span></dd></div>
                <div><dt>Growth stage</dt><dd><span className="seed-pill">{seed.growthStage === "Seed" ? "🌰" : "🌱"} {seed.growthStage}</span></dd></div>
                <div className="seed-detail-wide"><dt>Paths to explore</dt><dd><ol>{seed.pathsToExplore.map((path) => <li key={path}>{path}</li>)}</ol></dd></div>
                <div className="seed-detail-wide first-step"><dt>First step</dt><dd>{seed.firstStep}</dd></div>
              </dl>
              <div className="result-actions">
                <button className="button button-primary" type="button" onClick={() => void handleCopySeed()}>Copy this Seed</button>
                <button className="button button-secondary" type="button" onClick={() => void growIdea()}>Grow it again</button>
                <button className="button button-secondary" type="button" onClick={editIdea}>Edit the idea</button>
                <button className="button button-secondary" type="button" onClick={reset}>Plant another idea</button>
              </div>
            </article>
          )}
        </div>
        <p className="sr-status" role="status" aria-live="polite">{copyStatus || message}</p>
      </section>

      <section className="sample-seeds" aria-labelledby="sample-title">
        <div>
          <p className="eyebrow">Ideas to borrow</p>
          <h2 id="sample-title">Try a sample seed</h2>
          <p className="section-tagline">Not sure what to plant? Begin with one of these.</p>
        </div>
        <div className="sample-grid">
          {sampleCards.map((sample) => (
            <button className="sample-card card" type="button" key={sample.name} onClick={() => chooseIdea(sample.text)}>
              <span aria-hidden="true">{sample.icon}</span>
              <strong>{sample.name}</strong>
              <small>{sample.text}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="greenhouse-ending" aria-labelledby="ending-title">
        <div><p className="eyebrow">From here</p><h2 id="ending-title">Every idea needs a first step.</h2><p>每一个想法，都需要一个开始。</p></div>
        <div className="ending-actions">
          <Link className="button button-primary" href="/forest">Follow a question into the Forest →</Link>
          <Link className="button button-secondary" href="/garden">See what is already growing →</Link>
        </div>
      </section>
    </main>
  );
}

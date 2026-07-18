import Link from "next/link";
import { gardenItems } from "@/content/garden";
import { regions } from "@/lib/regions";
import { createPublicPageMetadata } from "@/lib/seo";
import { HiddenSeed, Opening, RandomCompass } from "./home-interactions";
import "./home.css";

export const metadata = createPublicPageMetadata({
  title: "Home",
  description: "A digital garden of growing ideas.",
  path: "/",
});

const currentlyGrowing = [
  { ...gardenItems[0], meta: "🌿 Growing · Garden", href: "/garden/building-the-garden" },
  { ...gardenItems[1], meta: "🌿 Growing · Garden", href: "/garden/learning-psychological-statistics" },
  { ...gardenItems[2], meta: "🌱 Sprout · Garden", href: "/garden/exploring-ai-tools" },
  {
    title: "Continuing “继续吗”",
    summary: "一个关于记忆、遗忘与写作的故事。",
    meta: "🌱 Sprout · Forest",
    cta: "Follow the memory →",
    href: "/forest/why-people-fear-forgetting",
  },
] as const;

const recentlyPlanted = [
  {
    title: "The Garden",
    summary: "从一个普通个人网站开始，慢慢长成一座可以自由探索的数字花园。",
    meta: "🌱 Garden · 🌿 Growing",
    cta: "See how it grows →",
    href: "/garden/building-the-garden",
  },
  {
    title: "继续吗",
    summary: "一个关于记忆、遗忘、写作，以及一个不愿相信自己记忆的人的故事。",
    meta: "🌲 Forest · 🌱 Sprout",
    cta: "Follow the memory →",
    href: "/forest/why-people-fear-forgetting",
  },
] as const;

const mapActions: Record<string, string> = {
  Home: "Return home →",
  Garden: "See what is growing →",
  Forest: "Follow a question →",
  Lake: "Look beneath the surface →",
  Ruins: "Read the traces →",
  Greenhouse: "Grow an idea →",
};

function SectionHeading({ id, title, tagline, description }: { id: string; title: string; tagline?: string; description?: string }) {
  return (
    <header className="home-section-heading">
      <h2 id={id}>{title}</h2>
      {tagline && <p className="home-tagline">{tagline}</p>}
      {description && <p className="home-description">{description}</p>}
    </header>
  );
}

export default function HomePage() {
  return (
    <main id="main-content" tabIndex={-1} className="home">
      <Opening />

      <section className="home-section welcome" id="welcome" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <p className="eyebrow">A quiet place to begin.</p>
          <h1 id="welcome-title">Welcome to The Garden.</h1>
          <p className="welcome-subtitle">A digital garden of growing ideas.</p>
          <div className="welcome-body">
            <p>这里种着我正在学习、思考和创造的东西。</p>
            <p>有些已经开花，有些刚刚发芽，还有一些暂时停在原地。</p>
            <p>你不需要按照固定顺序浏览。</p>
            <p>随便选择一条小径，看看它会通向哪里。</p>
          </div>
        </div>
        <div className="garden-visual" aria-hidden="true">
          <span className="sun" />
          <span className="hill hill-back" />
          <span className="hill hill-front" />
          <span className="stem stem-one"><i /><b /></span>
          <span className="stem stem-two"><i /><b /></span>
          <span className="stem stem-three"><i /><b /></span>
          <span className="garden-path" />
        </div>
      </section>

      <section className="home-section about" aria-labelledby="about-title">
        <SectionHeading id="about-title" title="About the gardener" tagline="The person tending these ideas." />
        <div className="about-layout">
          <div className="about-copy card">
            <p>你好，我是籼宏。</p>
            <p>一名正在学习心理学，也在尝试理解人工智能、设计与人的大学生。</p>
            <p>我喜欢把一个问题慢慢拆开，也喜欢把不够满意的东西继续修改。</p>
            <p>这里没有很多已经完成的答案。</p>
            <p>更多的是正在生长的问题、想法和尝试。</p>
          </div>
          <ul className="personality-seeds" aria-label="Personality Seeds">
            <li><strong>Curious</strong><span>喜欢追问为什么。</span></li>
            <li><strong>Patient</strong><span>愿意慢慢打磨细节。</span></li>
            <li><strong>Still learning</strong><span>接受不成熟的过程。</span></li>
            <li><strong>Open to detours</strong><span>相信绕路也会带来发现。</span></li>
          </ul>
        </div>
      </section>

      <section className="home-section growing" aria-labelledby="growing-title">
        <SectionHeading id="growing-title" title="Currently Growing" tagline="What is taking root right now." description="这里记录我最近正在学习、尝试和持续推进的内容。" />
        <div className="home-card-grid home-card-grid-four">
          {currentlyGrowing.map((item) => (
            <article className="home-content-card card" key={item.title}>
              <p className="card-meta">{item.meta}</p>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <Link className="text-link" href={item.href}>{item.cta}</Link>
            </article>
          ))}
        </div>
        <div className="supporting-copy"><p>These may look different next time.</p><p>下次再来时，它们可能已经长成别的样子。</p></div>
      </section>

      <section className="home-section paths" aria-labelledby="paths-title">
        <SectionHeading id="paths-title" title="Paths from here" tagline="Choose a path. See where it leads." description="从这里选择一条小径，看看它会通向哪里。" />
        <div className="garden-map" aria-label="Garden map">
          <svg className="map-lines" viewBox="0 0 1000 590" preserveAspectRatio="none" aria-hidden="true">
            <path d="M500 295 C390 240 320 145 195 105" />
            <path d="M500 295 C610 235 700 145 810 105" />
            <path d="M500 295 C350 320 250 370 145 475" />
            <path d="M500 295 C650 320 755 370 855 475" />
            <path d="M500 295 C500 380 500 445 500 520" />
          </svg>
          {regions.map((region) => (
            <Link key={region.name} href={region.href} className={`map-node map-${region.name.toLowerCase()}`}>
              <span className="map-name">{region.name}</span>
              <span className="map-tagline">{region.tagline}</span>
              <span className="map-description">{region.description}</span>
              <span className="map-cta">{mapActions[region.name]}</span>
            </Link>
          ))}
        </div>
        <div className="path-list">
          {regions.map((region) => (
            <Link key={region.name} href={region.href} className="path-list-item card">
              <span className="path-marker" aria-hidden="true" />
              <span><strong>{region.name}</strong><small>{region.tagline}</small><span>{region.description}</span><em>{mapActions[region.name]}</em></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section recent" aria-labelledby="recent-title">
        <SectionHeading id="recent-title" title="Recently Planted" tagline="New seeds have appeared in the garden." description="这里展示最近被种下的想法、记录和尝试。" />
        <div className="home-card-grid home-card-grid-two">
          {recentlyPlanted.map((item) => (
            <article className="home-content-card recent-card card" key={item.title}>
              <p className="card-meta">{item.meta}</p>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <Link className="text-link" href={item.href}>{item.cta}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section compass-section" aria-labelledby="compass-title">
        <SectionHeading id="compass-title" title="Where next?" />
        <RandomCompass />
      </section>

      <section className="home-ending" aria-label="A path onward">
        <HiddenSeed />
        <p className="ending-lead">You do not have to see everything today.</p>
        <p>Pick a path. Come back when something new has grown.</p>
        <p className="ending-cn">不必一次看完。</p>
        <p>选一条小径继续走，等新的东西长出来时再回来。</p>
      </section>
    </main>
  );
}

import type { RegionName } from "@/types";

export type DetailBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "notes"; items: { title: string; text: string }[] };

export type RelatedPath = { label: string; href?: string };

export type DetailContent = {
  explanation?: string;
  sections?: { title: string; blocks: DetailBlock[] }[];
  relatedPaths: RelatedPath[];
  relatedTitle?: string;
};

const greenhouseIdea = (idea: string) => `/greenhouse?idea=${encodeURIComponent(idea)}`;

export const unfinishedMessages: Record<RegionName, string> = {
  Garden: "This seed is still being tended.",
  Forest: "This thought is still growing.",
  Lake: "This reflection has not been fully written yet.",
  Ruins: "Only part of this trace remains.",
};

export const detailContent: Record<RegionName, Record<string, DetailContent>> = {
  Garden: {
    "building-the-garden": {
      sections: [
        { title: "Why it was planted", blocks: [
          { type: "paragraph", text: "最初，这是一份个人网站制作作业。" },
          { type: "paragraph", text: "在确定网站方向时，我不希望它只是一个普通的自我介绍页面，也不想假装自己已经拥有很多成熟项目。" },
          { type: "paragraph", text: "于是，我开始把它想象成一座数字花园。" },
          { type: "paragraph", text: "这里不只展示完成的结果，也保存仍在成长的问题、学习和尝试。" },
        ] },
        { title: "What has grown so far", blocks: [{ type: "list", items: ["数字花园的整体世界观", "Home、Garden、Forest、Lake、Ruins 和 Greenhouse 六个 Regions", "Seed 生命周期", "Home 页面结构", "Garden 页面结构", "AI Seed Gardener 的基本方向"] }] },
        { title: "Growth notes", blocks: [{ type: "notes", items: [
          { title: "The idea took root", text: "确定网站的数字花园定位。" },
          { title: "The paths became clearer", text: "完成 Home 页面结构精简，并开始设计 Garden Region。" },
        ] }] },
      ],
      relatedTitle: "Where this path leads next",
      relatedPaths: [
        { label: "Continue into Coding", href: "/garden/python-starting-from-the-basics" },
        { label: "See the Home design", href: "/" },
        { label: "Grow an idea in the Greenhouse", href: "/greenhouse" },
      ],
    },
    "learning-psychological-statistics": {
      sections: [
        { title: "Why it was planted", blocks: [
          { type: "paragraph", text: "心理统计学中，真正困难的往往不只是记住一个公式，而是判断题目正在问什么。" },
          { type: "paragraph", text: "同样是 t 检验，题目可能要求判断差异、方向、显著性或置信区间。如果没有先理解问题，查表和计算就很容易混在一起。" },
          { type: "paragraph", text: "因此，我开始把常见概念和题型重新整理，希望形成一套在考试中也能快速使用的判断顺序。" },
        ] },
        { title: "What has grown so far", blocks: [{ type: "list", items: ["怎样根据研究假设判断单侧检验和双侧检验", "“显著高于”和“显著低于”分别对应什么方向", "如何确定自由度并查阅临界值", "置信区间和置信度之间的关系", "判断题和选择题中容易混淆的表述", "做统计题时应当先判断什么、再计算什么"] }] },
        { title: "Growth notes", blocks: [{ type: "notes", items: [
          { title: "Finding the direction", text: "先根据题目中的“不同”“高于”或“低于”判断检验方向。" },
          { title: "Reading the table", text: "结合显著性水平、自由度和单侧或双侧要求查找临界值。" },
          { title: "Connecting the ideas", text: "把假设检验、显著性和置信区间放在同一套逻辑中理解，而不是分别死记。" },
        ] }] },
      ],
      relatedTitle: "Where this path leads next",
      relatedPaths: [
        { label: "Practice a complete t-test example" },
        { label: "Review confidence intervals" },
        { label: "Return to Psychology Seeds", href: "/garden" },
      ],
    },
    "exploring-ai-tools": { explanation: "这颗 Seed 记录我对 AI 学习辅助、创作支持和工具使用方式的持续尝试。", relatedPaths: [
      { label: "Grow an idea in the Greenhouse", href: "/greenhouse" }, { label: "Follow a question about humans and AI", href: "/forest/does-ai-help-thinking-or-organize-answers" }, { label: "Return to the Garden", href: "/garden" },
    ] },
    "python-starting-from-the-basics": { explanation: "这颗 Seed 保存从环境配置、基础语法到简单练习的学习起点。", relatedPaths: [
      { label: "Open Building The Garden", href: "/garden/building-the-garden" }, { label: "Return to the Garden", href: "/garden" },
    ] },
    "designing-better-slides-and-documents": { explanation: "这颗 Seed 记录如何通过排版、层级和信息组织，让内容更容易阅读和理解。", relatedPaths: [
      { label: "Follow a design question", href: "/forest/why-exploratory-websites-invite-more-clicks" }, { label: "Open Building The Garden", href: "/garden/building-the-garden" }, { label: "Return to the Garden", href: "/garden" },
    ] },
  },
  Forest: {
    "why-exploratory-websites-invite-more-clicks": {
      sections: [
        { title: "Why I started thinking about it", blocks: [
          { type: "paragraph", text: "在设计 The Garden 时，我发现自己不希望访客只是快速看完一份个人介绍。" },
          { type: "paragraph", text: "相比一次展示所有内容，我更想让人产生一种感觉：" },
          { type: "paragraph", text: "“我想再点一下，看看会发生什么。”" },
          { type: "paragraph", text: "这让我开始思考，探索式交互为什么会比普通导航更容易激发继续浏览的欲望。" },
        ] },
        { title: "What I think so far", blocks: [
          { type: "paragraph", text: "目前我觉得，探索欲可能来自三个方面：" },
          { type: "list", items: ["页面没有一次展示全部信息", "每次点击都会带来新的内容", "访客能够自己选择下一条路径"] },
          { type: "paragraph", text: "但隐藏信息也可能降低可用性。" },
          { type: "paragraph", text: "所以真正重要的并不是把导航藏起来，而是在清晰和未知之间保持平衡。" },
        ] },
      ],
      relatedTitle: "Where it may lead",
      relatedPaths: [
        { label: "See how this idea shaped The Garden", href: "/garden/building-the-garden" },
        { label: "Explore psychology and user experience", href: "/forest/how-psychology-shapes-product-and-web-design" },
        { label: "Grow this question in the Greenhouse", href: greenhouseIdea("为什么探索式网站会让人更愿意继续点击？") },
      ],
    },
    "why-people-fear-forgetting": {
      sections: [
        { title: "Why I started thinking about it", blocks: [
          { type: "paragraph", text: "在构思《继续吗》时，我为主角设置了一个特点：他不完全相信自己的记忆，也害怕重要的事情在没有被记录时慢慢消失。" },
          { type: "paragraph", text: "这让我开始思考，人害怕遗忘的究竟是什么。" },
          { type: "paragraph", text: "我们担心的也许不只是忘记一个名字或一件事，而是害怕某段经历失去证明，甚至害怕过去的自己也随之变得模糊。" },
        ] },
        { title: "What I think so far", blocks: [
          { type: "paragraph", text: "目前我觉得，记忆和自我之间存在很深的联系。" },
          { type: "paragraph", text: "人会通过记忆理解“我是谁”“我经历过什么”，也会通过记录为过去留下可以重新找到的痕迹。" },
          { type: "paragraph", text: "因此，写日记、拍照、保存文字或反复讲述一个故事，可能不只是为了保存信息，也是在确认某些经历确实发生过。" },
          { type: "paragraph", text: "但记录并不能完整替代记忆。" },
          { type: "paragraph", text: "它留下的是片段，而每次重新阅读这些片段时，人也可能用现在的自己重新理解过去。" },
          { type: "paragraph", text: "这个问题也成为故事《继续吗》的起点之一。" },
        ] },
      ],
      relatedTitle: "Where it may lead",
      relatedPaths: [
        { label: "Read the trace left by “继续吗”", href: "/ruins/unfinished-continue" },
        { label: "Explore memory and identity", href: "/forest" },
        { label: "Grow this question in the Greenhouse", href: greenhouseIdea("人为什么会害怕遗忘？") },
      ],
    },
    "does-ai-help-thinking-or-organize-answers": { explanation: "这个问题关注使用 AI 时，辅助思考与替代思考之间的界限。", relatedPaths: [
      { label: "Explore AI Tools", href: "/garden/exploring-ai-tools" }, { label: "Grow this question", href: greenhouseIdea("AI 可以帮助人思考，还是只是在替人组织答案？") }, { label: "Return to the Forest", href: "/forest" },
    ] },
    "how-psychology-shapes-product-and-web-design": { explanation: "这个问题关注注意、行为和心理规律怎样影响界面与用户体验。", relatedPaths: [
      { label: "Follow the exploratory website question", href: "/forest/why-exploratory-websites-invite-more-clicks" }, { label: "Open Building The Garden", href: "/garden/building-the-garden" }, { label: "Return to the Forest", href: "/forest" },
    ] },
    "when-a-question-moves-from-forest-to-garden": { explanation: "当一个问题已经能够转化为练习、项目或下一步行动时，它可能正在从思考走向生长。", relatedPaths: [
      { label: "See what is growing", href: "/garden" }, { label: "Grow the question in the Greenhouse", href: "/greenhouse" }, { label: "Return to the Forest", href: "/forest" },
    ] },
  },
  Lake: {
    "reverse-1999": { sections: [
      { title: "What it is", blocks: [{ type: "paragraph", text: "一款以时间、历史与失序为重要叙事元素的角色扮演游戏。" }] },
      { title: "Why it stayed", blocks: [{ type: "paragraph", text: "它的美术、时代感和叙事方式，让游戏世界像一段被重新拼起的记忆。" }] },
      { title: "What it reflects", blocks: [{ type: "paragraph", text: "我喜欢那些不急着解释全部背景，而是让人通过细节、氛围和碎片逐渐理解世界的作品。" }] },
    ], relatedPaths: [{ label: "Return to the Lake", href: "/lake" }, { label: "Follow a reflection into the Forest", href: "/forest" }] },
    "love-love-love": { sections: [
      { title: "What it is", blocks: [{ type: "paragraph", text: "方大同演唱的一首歌曲。" }] },
      { title: "Why it stayed", blocks: [{ type: "paragraph", text: "它把感情写得轻盈又真诚，旋律结束以后，情绪仍然会停留一会儿。" }] },
      { title: "What it reflects", blocks: [{ type: "paragraph", text: "我喜欢不需要过度用力，却能留下长久情绪的表达。" }] },
    ], relatedPaths: [{ label: "Return to the Lake", href: "/lake" }, { label: "Follow a reflection into the Forest", href: "/forest" }] },
    "summer-ghost": { sections: [
      { title: "What it is", blocks: [{ type: "paragraph", text: "一部围绕三名少年、传说中的幽灵与短暂夏日相遇展开的动画作品。" }] },
      { title: "Why it stayed", blocks: [{ type: "paragraph", text: "它用短暂的夏日相遇讨论死亡、孤独与继续生活，安静却留下了很深的余韵。" }] },
      { title: "What it reflects", blocks: [{ type: "paragraph", text: "我会被那些节奏克制、篇幅不长，却能认真触碰记忆、孤独与生命意义的故事吸引。" }] },
    ], relatedPaths: [{ label: "Return to the Lake", href: "/lake" }, { label: "Follow a reflection into the Forest", href: "/forest" }] },
    "jung-and-mandala": { explanation: "这项 Reflection 关注曼陀罗如何被荣格用来理解心灵的秩序与完整性。", relatedPaths: [{ label: "Explore Mind & Behavior", href: "/forest" }, { label: "Return to the Lake", href: "/lake" }] },
    "the-garden": { explanation: "这项 Reflection 保存 The Garden 作为一个网络空间所形成的氛围与意义。", relatedPaths: [{ label: "See how The Garden was built", href: "/garden/building-the-garden" }, { label: "Return Home", href: "/" }, { label: "Return to the Lake", href: "/lake" }] },
  },
  Ruins: {
    "first-version-of-home": { sections: [
      { title: "What it was", blocks: [{ type: "paragraph", text: "最初的 Home 被设计为七个部分，包括独立的 Welcome、About、Currently Growing、完整路径入口、Recently Planted、指南针和页脚。" }, { type: "paragraph", text: "每个部分单独看都合理，但放在一起后，页面开始出现重复。" }] },
      { title: "Why it stopped", blocks: [{ type: "paragraph", text: "Welcome 和 About 都在介绍网站与个人。" }, { type: "paragraph", text: "首页前半部分和 Garden Map 都在引导访客选择路径。" }, { type: "paragraph", text: "Currently Growing 和多个状态模块也重复表达“最近在做什么”。" }, { type: "paragraph", text: "这会让首页过长，也会增加开发和维护成本。" }] },
      { title: "What it left behind", blocks: [{ type: "paragraph", text: "它帮助我们确认：" }, { type: "list", items: ["美学不等于堆叠内容", "同一种信息只需要出现一次", "探索感必须建立在清晰结构上", "开发说明需要区分内部名称与展示名称"] }] },
    ], relatedTitle: "What grew from it", relatedPaths: [
      { label: "See the current Home design", href: "/" }, { label: "Open Building The Garden", href: "/garden/building-the-garden" }, { label: "Follow the question about exploratory websites", href: "/forest/why-exploratory-websites-invite-more-clicks" },
    ] },
    "portfolio-never-built": { explanation: "传统作品集的方向被放弃后，留下了“怎样真实展示尚未成熟的自己”这个问题。", relatedPaths: [{ label: "Open Building The Garden", href: "/garden/building-the-garden" }, { label: "Reflect on The Garden", href: "/lake/the-garden" }, { label: "Return to the Ruins", href: "/ruins" }] },
    "too-much-interaction": { explanation: "这次尝试留下的经验是：探索感不能以清晰度和可用性为代价。", relatedPaths: [{ label: "Follow the exploratory website question", href: "/forest/why-exploratory-websites-invite-more-clicks" }, { label: "See the current Home", href: "/" }, { label: "Return to the Ruins", href: "/ruins" }] },
    "unfinished-continue": { explanation: "虽然这段版本没有继续完成，但其中关于记忆和遗忘的主题被保留了下来。", relatedPaths: [{ label: "Follow the question about forgetting", href: "/forest/why-people-fear-forgetting" }, { label: "Return to the Ruins", href: "/ruins" }] },
  },
};

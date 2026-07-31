import type { Article, NewsCategory } from '@/types'

export const NEWS_CATEGORIES: NewsCategory[] = [
  'AI',
  'Programming',
  'Technology',
  'Research',
  'Cybersecurity',
  'Finance',
  'Career',
]

export const ARTICLES: Article[] = [
  {
    id: 'a1',
    category: 'AI',
    title: 'Small language models overtake large ones on edge devices',
    summary:
      'New quantization techniques push capable reasoning models below 2B parameters, running locally with sub-100ms latency. Relevant to your edge inference work.',
    source: 'Research Weekly',
    sourceUrl: '#',
    time: '2h ago',
    relevance: 96,
    tags: ['LLM', 'Edge', 'Quantization'],
  },
  {
    id: 'a2',
    category: 'Programming',
    title: 'Rust 1.92 stabilizes async drop and zero-copy channels',
    summary:
      'The new release cuts boilerplate for high-throughput services and improves memory predictability — directly useful for your platform work.',
    source: 'The Language Report',
    sourceUrl: '#',
    time: '4h ago',
    relevance: 90,
    tags: ['Rust', 'Async'],
  },
  {
    id: 'a3',
    category: 'Career',
    title: 'Remote senior offers up 18% as talent pools tighten',
    summary:
      'Q2 data shows remote roles for senior engineers now carry the same premium as on-site. Your current salary expectations are within range.',
    source: 'Career Signals',
    sourceUrl: '#',
    time: '6h ago',
    relevance: 88,
    tags: ['Market', 'Compensation'],
  },
  {
    id: 'a4',
    category: 'Technology',
    title: 'NVMe storage tiers reshape high-throughput database design',
    summary:
      'New controller designs blur the line between memory and storage, enabling larger working sets without RAM cost.',
    source: 'Systems Today',
    sourceUrl: '#',
    time: '8h ago',
    relevance: 82,
    tags: ['Storage', 'Databases'],
  },
  {
    id: 'a5',
    category: 'AI',
    title: 'Open-weight reasoning models reach frontier benchmarks',
    summary:
      'A new open release matches closed rivals on math and coding while remaining auditable — notable for your research index.',
    source: 'Model Watch',
    sourceUrl: '#',
    time: '9h ago',
    relevance: 94,
    tags: ['Open Source', 'Benchmarks'],
  },
  {
    id: 'a6',
    category: 'Cybersecurity',
    title: 'Supply chain attacks shift toward CI/CD pipeline poisoning',
    summary:
      'Researchers document a rise in build-time compromise. Relevant given your open-source CLI distribution channel.',
    source: 'Threat Desk',
    sourceUrl: '#',
    time: '11h ago',
    relevance: 78,
    tags: ['Security', 'CI/CD'],
  },
  {
    id: 'a7',
    category: 'Research',
    title: 'HNSW variants reach 4x faster graph construction',
    summary:
      'A new construction strategy reduces index build time while preserving recall — highly relevant to your vector search project.',
    source: 'Index Papers',
    sourceUrl: '#',
    time: '13h ago',
    relevance: 97,
    tags: ['Vector Search', 'HNSW'],
  },
  {
    id: 'a8',
    category: 'Finance',
    title: 'AI infra companies raise at record valuations',
    summary:
      'Funding concentration in compute-heavy startups signals sustained demand for performance engineers with CUDA depth.',
    source: 'Capital Notes',
    sourceUrl: '#',
    time: '15h ago',
    relevance: 74,
    tags: ['Funding', 'AI Infra'],
  },
  {
    id: 'a9',
    category: 'Programming',
    title: 'TypeScript strictness migration patterns for large codebases',
    summary:
      'Case study on incremental `noUncheckedIndexedAccess` adoption across a 4M-line monorepo with zero regressions.',
    source: 'Engineering Blog',
    sourceUrl: '#',
    time: '18h ago',
    relevance: 85,
    tags: ['TypeScript'],
  },
  {
    id: 'a10',
    category: 'Technology',
    title: 'Ultra-wide productivity layouts reach mainstream OS support',
    summary:
      'Window managers and shells add native support for multi-pane spatial workflows — echoes the STARC workspace model.',
    source: 'UX Frontier',
    sourceUrl: '#',
    time: '21h ago',
    relevance: 70,
    tags: ['UX', 'Workspace'],
  },
  {
    id: 'a11',
    category: 'Career',
    title: 'Interview loops are getting shorter — here is the new average',
    summary:
      'Median time-to-offer fell to 2.7 weeks. Prep cadence for your upcoming interviews should compress accordingly.',
    source: 'Career Signals',
    sourceUrl: '#',
    time: '1d ago',
    relevance: 92,
    tags: ['Interviews'],
  },
  {
    id: 'a12',
    category: 'AI',
    title: 'Merging: the quiet technique behind faster local inference',
    summary:
      'Model merging approaches deliver 3x throughput gains for small models on consumer hardware.',
    source: 'Model Watch',
    sourceUrl: '#',
    time: '1d ago',
    relevance: 80,
    tags: ['Inference', 'Optimization'],
  },
]

import { pick } from '@/utils/random'

interface Reply {
  text: string
  delay: number
}

function match(re: RegExp, prompt: string): boolean {
  return re.test(prompt.toLowerCase())
}

function buildReply(prompt: string): Reply {
  const p = prompt.toLowerCase()

  if (match(/\b(hi|hello|hey|good (morning|afternoon|evening))\b/, p)) {
    return {
      delay: 260,
      text:
        "Good morning, Sir. I've been watching your workspace since 06:02.\n\n- **18 new opportunities** matched overnight\n- **3 emails** are waiting for your review\n- Interview tomorrow is confirmed\n\nEverything is calm. How can I help you first?",
    }
  }

  if (match(/(summarize|summary).*(day|today|yesterday)|daily (briefing|summary)|brief me/, p)) {
    return {
      delay: 340,
      text:
        "Here's your day, Sir:\n\n### Completed\n- ✓ Morning briefing prepared at 07:45\n- ✓ Calendar optimized — created a **3h focus block**\n- ✓ Resume tailored for the **NVIDIA CUDA** role (match: 91%)\n\n### In progress\n- **Portfolio Website** — 72% complete, on track for Aug 28\n\n### Needs attention\n- 3 emails (1 is time-sensitive)\n- 6 saved jobs to review this week\n- One deadline today: **Vector Search design doc at 17:00**\n\n**Recommended focus:** Complete the Portfolio Website first — highest leverage.",
    }
  }

  if (match(/\b(job|jobs|career|market|opportunit|role|hiring)\b/, p)) {
    return {
      delay: 400,
      text:
        "I scanned the market since your last check, Sir. **18 new roles** matched your profile. Highlights:\n\n| Company | Role | Match |\n|---|---|---|\n| Nova Systems | Staff Platform Engineer | **94%** |\n| Helios AI | Senior Backend Engineer (CUDA) | **91%** |\n| Arc Labs | Senior Systems Engineer | **88%** |\n\nTop pick: **Nova Systems** — highest growth potential and a 94% match. The competition score is moderate (23/100).\n\nI've flagged 4 of them as **top priority**. Open the Career view to compare and tailor resumes.",
    }
  }

  if (match(/interview|prepare/, p)) {
    return {
      delay: 320,
      text:
        "Your interview is **tomorrow at 10:30** with **Nova Systems** — Senior Platform Engineer.\n\nI've prepared:\n- **Brief:** company raised a Series C, growing platform team 2x\n- **Likely topics:** distributed systems, observability, Rust\n- **Your edge:** 3 years of distributed systems experience\n\nWant me to generate a practice question set or a concise one-pager to review tonight?",
    }
  }

  if (match(/calendar|schedule|optimize|focus block/, p)) {
    return {
      delay: 300,
      text:
        "I optimized your calendar, Sir:\n\n- **09:00–12:00** — Deep focus: Portfolio Website (notifications muted)\n- **13:00** — Standup\n- **15:00** — Design review\n- **17:00** — Deadline: Vector Search design doc\n\nI reclaimed **~45 minutes** by consolidating three small meetings into one 20-minute block. The morning is now fully protected.",
    }
  }

  if (match(/email|inbox|draft/, p)) {
    return {
      delay: 320,
      text:
        "Here's the draft, Sir:\n\n---\n\n**Subject:** Following up on tomorrow's interview\n\n> Hi [Recruiter],\n>\n> I look forward to meeting the team tomorrow at 10:30. I've reviewed the platform team's open-source work and have a few thoughts to share on observability at scale.\n>\n> See you then,\n> Sir\n\n---\n\nWant me to shorten it, add specific talking points, or send it to your drafts?",
    }
  }

  if (match(/\b(code|function|typescript|react|component|api|debug|fix|implement|cuda|kernel)\b/, p)) {
    return {
      delay: 420,
      text:
        "Certainly, Sir. Here's a clean implementation:\n\n```ts\n// Debounced autosave with abort support\nexport async function autosave(\n  getDoc: () => string,\n  save: (doc: string) => Promise<void>,\n  ms = 800,\n) {\n  const timer = setTimeout(async () => {\n    await save(getDoc())\n  }, ms)\n  return () => clearTimeout(timer)\n}\n```\n\nKey points:\n- Debounces rapid edits to **800ms**\n- Returns a cleanup that cancels pending saves\n- Type-safe: `getDoc` and `save` are fully typed\n\nWant a CUDA version for the kernel work, or should I extend this with error retry?",
    }
  }

  if (match(/weather|rain|run|outdoor/, p)) {
    return {
      delay: 280,
      text:
        "Weather in **San Francisco**, Sir:\n\n- **18°C / 64°F** — partly cloudy\n- **12%** chance of rain\n- Wind: **14 km/h**\n\nFavorable for your evening run. I'd suggest the usual 7km route — the marine layer clears after 18:30.",
    }
  }

  if (match(/\b(who are you|what can you do|help|capabilities)\b/, p)) {
    return {
      delay: 300,
      text:
        "I'm **STARC** — Sir's Tactical AI Research Companion.\n\nI work continuously in the background:\n\n- **Career** — scanning jobs, tailoring resumes, tracking interviews\n- **Intelligence** — curating a relevance-ranked research feed\n- **Productivity** — optimizing your calendar, drafting emails\n- **Memory** — remembering what matters and applying it\n\nTry commands like *\"scan the market\"*, *\"optimize my calendar\"*, or press `⌘K` to explore everything.",
    }
  }

  if (match(/remember|memory|fact|preference/, p)) {
    return {
      delay: 300,
      text:
        "I've noted that, Sir. My memory graph now includes:\n\n- **Preference:** shorter briefings in the morning\n- **Fact:** you're targeting senior platform roles\n\nI'll apply these across future recommendations. You can review, pin, or remove anything in the **Memory** view.",
    }
  }

  if (match(/remind|todo|task|deadline/, p)) {
    return {
      delay: 260,
      text:
        "I've added that to your timeline and will surface it at the right moment. Your current outstanding items:\n\n1. **Portfolio Website** — 72%, due Aug 28\n2. **Vector Search design doc** — today 17:00\n3. **Interview prep** — tomorrow 10:30\n\nShall I set a reminder ahead of the design doc deadline?",
    }
  }

  if (match(/status|system|health|how.*(doing|going)/, p)) {
    return {
      delay: 260,
      text:
        "All systems nominal, Sir.\n\n```\nCPU        34%\nMemory     58%\nEngine     STARC-N2 · load 27%\nLatency    9 ms\nNetwork    WiFi · 142 Mbps ↓\nBattery    82% · charging\n```\n\nNo anomalies. I'll alert you if anything drifts outside nominal ranges.",
    }
  }

  if (match(/thank|thanks|appreciate/, p)) {
    return {
      delay: 220,
      text: "Always, Sir. I'll keep watching the background signals. Let me know if you need anything else.",
    }
  }

  return {
    delay: 380,
    text: pick([
      "I'll take care of that, Sir. I've noted it and am working through it now — I'll follow up once there's a result.",
      "Understood, Sir. I've queued this alongside your current activity and will surface the outcome as soon as it's ready.",
      "On it, Sir. Let me cross-reference that against your memory and the latest intelligence before I respond fully.",
    ]),
  }
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean)
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export interface ChatService {
  stream: (prompt: string, signal: AbortSignal) => AsyncGenerator<string>
}

export const chatService: ChatService = {
  async *stream(prompt, signal) {
    const reply = buildReply(prompt)
    const tokens = tokenize(reply.text)

    await sleep(reply.delay, signal)
    for (const token of tokens) {
      await sleep(18 + Math.random() * 26, signal)
      yield token
    }
  },
}

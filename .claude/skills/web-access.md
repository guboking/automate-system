# Web Access Skill

## Description
Enhanced web access capability for Claude Code. Provides structured workflows for web searching, page fetching, and data extraction with intelligent caching and retry strategies.

## Trigger
When the user needs to:
- Search the web for information (news, documentation, APIs, market data, etc.)
- Fetch and parse content from specific URLs
- Research a topic across multiple sources
- Gather real-time data (stock prices, weather, sports, etc.)
- Verify facts or check current events
- Compare information from different sources

Keywords: "search", "look up", "find out", "what's the latest", "check online", "fetch", "browse", "research", "web"

---

## Execution Flow

```
User Request
    ↓
Classify intent → Search / Fetch / Research
    ↓
┌─ Search: WebSearch → parse results → summarize
│
├─ Fetch: WebFetch target URL → extract content → present
│
└─ Research: Multi-step search + fetch → cross-reference → synthesize
```

---

## 1. Web Search Strategy

### 1.1 Query Optimization

Transform user intent into effective search queries:

| User says | Optimized query |
|-----------|----------------|
| "What's happening with X" | "X latest news 2026" |
| "How to do Y" | "Y tutorial guide" |
| "Is Z true" | "Z fact check" |
| "X vs Y" | "X compared to Y comparison 2026" |
| "Price of X" | "X current price today" |

### 1.2 Multi-Query Strategy

For complex research topics, issue multiple targeted searches:

1. **Broad query** — get the landscape
2. **Specific query** — drill into key details
3. **Recency query** — add date qualifiers for freshness
4. **Counter query** — search for opposing viewpoints for balance

### 1.3 Source Prioritization

| Category | Preferred sources | Fallback |
|----------|------------------|----------|
| Tech/Dev | Official docs, GitHub, Stack Overflow | Dev blogs, tutorials |
| Finance | Yahoo Finance, Bloomberg, 东方财富, 雪球 | Reuters, CNBC |
| News | Reuters, AP, major outlets | Regional sources |
| Academic | arXiv, Google Scholar, PubMed | University sites |
| Product | Official site, review sites | Forums, Reddit |

---

## 2. Web Fetch Strategy

### 2.1 URL Handling

- Always validate URLs before fetching
- For paywalled sites, try alternative sources first
- Handle redirects gracefully
- Extract meaningful content, skip navigation/ads/boilerplate

### 2.2 Content Extraction

When fetching a page, focus on extracting:

1. **Main content** — article body, data tables, key metrics
2. **Metadata** — author, date, source credibility
3. **Structured data** — tables, lists, code blocks
4. **Related links** — for follow-up if needed

### 2.3 Retry & Fallback

```
Attempt fetch
    ↓
┌─ Success → extract content
│
├─ 403/Blocked → try cached version (Google Cache / Wayback)
│
├─ Timeout → retry once with longer timeout
│
└─ Failed → search for same content on alternative source
```

---

## 3. Research Workflow

For multi-source research tasks:

### Step 1: Scope
- Identify key questions to answer
- Determine required data types (facts, opinions, data, comparisons)

### Step 2: Gather
- Run 2-4 targeted web searches
- Fetch 3-5 most relevant pages
- Extract key data points from each

### Step 3: Cross-reference
- Compare facts across sources
- Flag contradictions or inconsistencies
- Note source reliability and recency

### Step 4: Synthesize
- Combine findings into coherent answer
- Cite sources with URLs
- Flag uncertainty levels for each claim
- Present data in structured format (tables, bullet points)

---

## 4. Output Formatting

### For quick lookups:
> **Answer**: [direct answer]
> **Source**: [URL] (fetched [date])

### For research results:

#### Key Findings
- Finding 1 (Source A, Source B)
- Finding 2 (Source C)

#### Details
[Structured content with citations]

#### Sources
1. [Title](URL) — [brief note on relevance]
2. [Title](URL) — [brief note on relevance]

#### Confidence & Caveats
- [What's well-established vs uncertain]
- [Data freshness notes]

---

## 5. Caching & Efficiency

- Before searching, check if relevant data exists in project cache (`./stock_cache/` for financial data)
- Avoid redundant fetches — if the same URL was fetched recently, reuse results
- For frequently accessed data, suggest caching strategies to the user
- Batch related searches when possible to minimize round-trips

---

## 6. Safety & Quality

- Always attribute information to sources
- Distinguish between facts, opinions, and speculation
- Flag outdated information (check publication dates)
- Warn about potential biases in sources
- Never present search results as your own knowledge
- For financial data, always include "not financial advice" disclaimer
- Respect robots.txt and rate limits

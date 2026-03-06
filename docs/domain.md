# Domain Knowledge

> Last reviewed: 2026-03-06

## Overview

Aeola is AEO infrastructure — it makes e-commerce product data discoverable and
consumable by AI agents. Where SEO optimized for search engine crawlers, AEO
optimizes for agentic systems that need structured, machine-readable product
information to recommend, compare, and transact on behalf of users.

Aeola's pipeline: crawl merchant sites -> extract compact accessibility tree
snapshots (~200-400 tokens per page) -> dynamically infer product schemas with
LLMs -> store structured JSON -> serve via MCP tools and REST API.

## AEO (Agent Engine Optimization)

### Aeola's Definition

In this project, AEO means "Agent Engine Optimization" — making product data
agent-consumable. This is broader than the industry's "Answer Engine
Optimization" (optimizing content to appear in AI-generated search answers).
Aeola doesn't just help merchants be _found_ by AI — it makes their data
_consumable and actionable_ by autonomous agents.

### The Optimization Evolution

- **SEO** — be found by search engines
- **AEO** — be the answer AI selects
- **AIEO** — be the recommendation AI makes
- **AAO** — be chosen when no human is in the loop

Each layer absorbs the previous. The key shift: engines that recommend -> agents
that act.

### Where Aeola Fits

Aeola sits at the infrastructure layer. Merchants can't optimize for agents if
their product data isn't structured. Aeola solves this:

- Crawls unstructured merchant websites (Playwright)
- Extracts compact page snapshots (~200-400 tokens via Agent Browser)
- Dynamically infers product schemas (OpenAI, no hardcoded schemas)
- Serves structured data via MCP + REST

Without this layer, agents can't discover products, and ACP transactions can't
happen. Aeola is the bridge between unstructured web content and the agent
economy.

### Key Concepts

- **GEO vs AEO**: "GEO gets you into the conversation; AEO gets you into the
  workflow." GEO = visibility in AI summaries. AEO = integration into agent
  actions.
- **AXO (Agent Experience Optimization)**: The 2026 bar — sites must be
  agent-ready with structured data, semantic HTML, and agent-readable formats.
- **CLEAR framework**: Concise, Logical headings, Evidence-based, Accessible.

## ACP (Agentic Commerce Protocol)

### Stripe/OpenAI ACP

The open standard for programmatic commerce between buyers, AI agents, and
businesses (agenticcommerce.dev). REST and MCP compatible. Apache 2.0.

Key capabilities:

- Checkout sessions (create, update, complete, cancel)
- Delegated payments via Stripe Shared Payment Tokens (PCI-compliant)
- Physical/digital goods, subscriptions, async purchase flows
- Launched Sept 2025 as OpenAI Instant Checkout in ChatGPT; in March 2026,
  OpenAI pivoted away from direct in-agent checkout due to low buying activity,
  technical sync challenges, and fraud/compliance hurdles — purchases now route
  through third-party retailer apps

Stakeholder roles:

- **Businesses**: maintain merchant-of-record status, control product selection
  and fulfillment through agent-facing endpoints
- **AI Agents**: discover and recommend products; transaction completion defers
  to merchant checkout flows
- **Payment Providers**: process agentic transactions via token exchange

### Virtuals Protocol ACP

A distinct protocol — agent-to-agent on-chain commerce with escrow.
Crypto-native, for autonomous agent service marketplaces. Adjacent but separate
from Stripe/OpenAI's ACP.

### Aeola's Relationship to ACP

Aeola is upstream of ACP. Agents need structured product catalogs before any
commerce can happen — Aeola provides that catalog. The industry's convergence on
discovery-then-redirect (rather than embedded checkout) validates Aeola's
positioning as the data layer that sits before transaction flows.

## MCP (Model Context Protocol)

Open protocol standardizing how LLM applications connect to external data and
tools. Servers expose tools, resources, and prompts; clients connect and call
them.

How Aeola uses MCP:

- Exposes four tools: list_products, search_products, get_product,
  ingest_merchant
- Streamable HTTP transport (SSE is deprecated)
- Any MCP-compatible agent (Claude, ChatGPT, custom) can query Aeola's product
  catalog
- MCP is the delivery mechanism; Aeola is the data pipeline

## UCP (Universal Commerce Protocol)

Google's open standard for agentic commerce. Enables AI agents (Google Search AI
Mode, Gemini) to discover and transact with merchants via modular capabilities:
Checkout, Identity Linking, Order, Payment Token Exchange, Extensions.
Transport-agnostic — supports REST, MCP, A2A, and embedded protocols.

Merchants advertise capabilities at `/.well-known/ucp` using a structured
profile. Capabilities use reverse-domain notation (e.g.,
`dev.ucp.shopping.checkout`) and are versioned in YYYY-MM-DD format.

### Aeola's Relationship to UCP

Aeola is upstream of UCP's checkout flow. UCP agents need structured product
catalogs to populate checkout line items — Aeola provides that catalog. Aeola
exposes a UCP discovery profile at `/.well-known/ucp` declaring a custom
`io.aeola.product_catalog` capability, and serves product data in Google
Merchant-compatible format via `/api/ucp/` endpoints.

Aeola does not implement checkout, payment, or identity capabilities — it is the
structured data source that sits upstream of transaction flows. The integration
path: Aeola crawls and extracts product data → exports in Google Merchant format
→ UCP checkout agents reference products by ID in their line items.

OpenAI's March 2026 pivot away from direct in-agent checkout validates UCP's
separation of discovery from transaction. The emerging consensus: agents excel
at finding and recommending products; merchants handle checkout in their own
flows. UCP's modular capability model supports this cleanly — discovery
capabilities operate independently of checkout capabilities.

## Industry Context (March 2026)

On March 5, 2026, OpenAI dropped direct checkout inside ChatGPT, citing low
buying activity, technical sync challenges with real-time inventory/pricing, and
fraud/compliance hurdles. Purchases now route to third-party retailer apps.

This validates the discovery-first architecture that Aeola and UCP embody:

- **Agents are good at discovery** — finding, comparing, and recommending
  products based on user intent
- **Merchants handle checkout** — inventory sync, payment processing, and
  fulfillment remain in merchant-controlled flows
- **The data layer is critical** — structured, agent-readable product catalogs
  (what Aeola provides) are the foundation both discovery and eventual
  transaction depend on

ACP continues as a protocol standard, but the direct-checkout-in-agent vision
has been scaled back across the industry. The convergence is toward
discovery-then-redirect, which is exactly where Aeola sits.

## Glossary

| Term | Definition                                                                |
| ---- | ------------------------------------------------------------------------- |
| AEO  | Agent Engine Optimization (Aeola) / Answer Engine Optimization (industry) |
| AIEO | AI Engine Optimization — be the recommendation                            |
| AAO  | Assistive Agent Optimization — be chosen autonomously                     |
| AXO  | Agent Experience Optimization — agent-readiness standard                  |
| GEO  | Generative Engine Optimization — visibility in AI summaries               |
| ACP  | Agentic Commerce Protocol — programmatic commerce standard                |
| MCP  | Model Context Protocol — LLM-to-external-data standard                    |
| UCP  | Universal Commerce Protocol — Google's agentic commerce standard          |

## References

- https://agenticcommerce.dev — ACP specification (Stripe/OpenAI)
- https://developers.openai.com/commerce — OpenAI Agentic Commerce docs
- https://modelcontextprotocol.io — MCP specification
- https://developers.google.com/merchant/ucp — UCP specification (Google)
- https://github.com/universal-commerce-protocol/ucp — UCP open-source spec
- https://searchengineland.com/aao-assistive-agent-optimization-469919

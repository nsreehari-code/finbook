# Finbook Data Repository

This repository is the database and knowledge store for **Finbook**, an Indian personal tax tracking system.

## Structure

- `DB/finbook.json` — The database (accounts, income, stocks, taxes)
- `lore/knowledge.json` — Institutional semantic memory (entity mappings, decisions, observations)
- `threads/` — Document processing threads (one folder per batch)
- `.github/copilot-instructions.md` — AI steward instructions
- `.github/agents/` — Copilot subagents

## How It Works

1. Drop financial documents into a batch via the Finbook UI or directly into a thread folder
2. The AI steward classifies, extracts, and proposes changes
3. Review proposed records and open items in chat
4. Respond to open items, steward resolves and updates
5. Confirm to merge the batch to main

## Evidence-Based Principle

All data extraction is evidence-based. If information is not explicitly stated in a source document, it is not entered. The system never infers, assumes, or fills from past data. When evidence is ambiguous, open items are created for user clarification.

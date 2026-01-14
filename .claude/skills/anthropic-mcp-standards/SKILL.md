# Local MCP Bundle (MCPB) Submission Skill

Package and submit local MCP servers to Anthropic's Connectors Directory for Claude Desktop.

## When to Use This Skill

Use this skill when you need to:
- Package an MCP server as an MCPB bundle for Claude Desktop
- Submit a local MCP to Anthropic's directory
- Audit an existing MCP against MCPB requirements

---

## Quick Start

```
Package [MCP_NAME] as MCPB for Anthropic directory submission
```

---

## What is MCPB?

MCPB (.mcpb) files are zip archives containing a local MCP server + manifest.json. They enable one-click installation in Claude Desktop.

**Key characteristics:**
- Runs locally on user's machine
- Communicates via stdio transport
- Bundles all dependencies
- Works offline
- No OAuth required
- **Claude Desktop only** (not web or mobile)

**When to use Local (MCPB) vs Remote:**

| Use Local MCPB | Use Remote Server |
|----------------|-------------------|
| Public APIs (SEC, EIA, World Bank) | User-specific data (Google Drive, Slack) |
| No auth needed from data source | OAuth required |
| Simple distribution | Need web/mobile support |
| Zero infrastructure cost | Centralized updates needed |

---

## Submission Form

**URL:** https://forms.gle/tyiAZvch1kDADKoP9

---

## Pre-Submission Checklist

### 1. Tool Annotations (CRITICAL)

Every tool MUST have safety annotations. This is the #1 rejection reason.

```javascript
{
  name: "get_filings",
  description: "Get SEC filings for a company",
  inputSchema: { ... },
  annotations: {
    title: "Get SEC Filings",           // Required: human-readable name
    readOnlyHint: true,                  // Required: true if tool only reads
    destructiveHint: false               // Required: true if tool modifies/deletes
  }
}
```

**Decision Matrix:**

| Tool Behavior | readOnlyHint | destructiveHint | Examples |
|--------------|--------------|-----------------|----------|
| Only reads data | `true` | `false` | search, get, list, fetch, query |
| Creates new data | `false` | `false` | create (non-destructive) |
| Modifies/deletes | `false` | `true` | update, delete, send |
| External requests | `false` | `true` | email, webhook, notification |
| Internal caching | `true` | `false` | Optimization OK |

**Verification:**
```bash
# Check all tools have annotations
grep -A 10 "annotations" src/index.ts
```

**Checklist:**
- [ ] Every tool has `annotations` object
- [ ] Every tool has `title` annotation
- [ ] Every tool has `readOnlyHint` explicitly set
- [ ] Every tool has `destructiveHint` explicitly set
- [ ] Annotations match actual behavior

---

### 1b. Structured Data Output with Zod (Recommended)

Return typed JSON data alongside human-readable text using the `zod` package for schema validation.

**Install Zod:**
```bash
npm install zod
```

**Why use structured data?**
- Claude receives typed data it can process programmatically
- Text content provides human-readable fallback
- Schema validation ensures data consistency
- Better for downstream processing and analysis

**Define Zod schemas for your output:**
```javascript
import { z } from "zod";

// Define output schema
const SearchResultsSchema = z.object({
  total: z.number(),
  documents: z.array(z.object({
    id: z.string(),
    title: z.string(),
    date: z.string().optional(),
    url: z.string()
  }))
});

// For arrays/lists
const CountrySchema = z.object({
  name: z.string(),
  code: z.string(),
  count: z.number()
});

const CountriesOutputSchema = z.object({
  countries: z.array(CountrySchema)
});
```

**Return both `content` and `structuredContent`:**
```javascript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  let formattedOutput = '';  // Human-readable text
  let structuredContent;      // Typed JSON data
  
  switch (name) {
    case 'search_documents':
      const result = await searchAPI(args);
      
      // Format as readable table for text output
      formattedOutput = `Found ${result.total} documents:\n\n`;
      formattedOutput += formatAsTable(result.documents);
      
      // Assign structured data (validated by Zod schema)
      structuredContent = {
        total: result.total,
        documents: result.documents.map(doc => ({
          id: doc.id,
          title: doc.title,
          date: doc.date,
          url: doc.url
        }))
      };
      break;
  }
  
  return {
    content: [{ type: 'text', text: formattedOutput }],
    structuredContent: structuredContent  // Claude receives this as typed data
  };
});
```

**Columnar text formatting helper:**
```javascript
function formatAsTable(documents) {
  if (!documents.length) return 'No documents found.';
  
  // Calculate column widths
  const idWidth = Math.max(4, ...documents.map(d => d.id.length));
  const titleWidth = Math.min(50, Math.max(5, ...documents.map(d => d.title.length)));
  
  // Header
  let table = `${'ID'.padEnd(idWidth)} | ${'Title'.padEnd(titleWidth)} | Date\n`;
  table += `${'-'.repeat(idWidth)}-+-${'-'.repeat(titleWidth)}-+------------\n`;
  
  // Rows
  for (const doc of documents) {
    const title = doc.title.length > titleWidth 
      ? doc.title.slice(0, titleWidth - 3) + '...' 
      : doc.title;
    table += `${doc.id.padEnd(idWidth)} | ${title.padEnd(titleWidth)} | ${doc.date || 'N/A'}\n`;
  }
  
  return table;
}
```

**Checklist:**
- [ ] Install `zod` package: `npm install zod`
- [ ] Define Zod schemas for each tool's output
- [ ] Return `structuredContent` with typed data
- [ ] Return `content` with human-readable text (table format recommended)
- [ ] Bundle Zod with esbuild: dependencies are included automatically

**Note:** Do NOT add `outputSchema` to tool definitions—this can cause issues with some MCP clients. Just return `structuredContent` in the handler.

---

### 2. manifest.json (Required)

Create with `mcpb init` or manually. Must include:

```json
{
  "manifest_version": "0.3",
  "name": "sec-edgar-mcp",
  "display_name": "SEC EDGAR",
  "version": "1.0.0",
  "description": "Access SEC EDGAR filings and company financial data",
  "author": {
    "name": "DeployContext",
    "url": "https://deploycontext.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/deploycontext/sec-edgar-mcp.git"
  },
  "license": "MIT",
  
  "server": {
    "type": "node",
    "entry_point": "dist/bundle.cjs",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/dist/bundle.cjs"]
    }
  },
  
  "compatibility": {
    "platforms": ["darwin", "win32"]
  },
  
  "tools": [
    {
      "name": "sec_lookup_company",
      "title": "Lookup Company",
      "description": "Look up a company by ticker symbol",
      "annotations": {
        "readOnlyHint": true,
        "destructiveHint": false
      }
    }
  ],
  
  "privacy_policies": [
    "https://deploycontext.com/privacy"
  ],
  
  "icon": "icon.png"
}
```

**Critical Fields:**
- [ ] `manifest_version`: "0.3" or higher (required for privacy_policies)
- [ ] `privacy_policies`: Array with HTTPS URL(s)
- [ ] `tools`: List all tools with annotations
- [ ] `compatibility.platforms`: ["darwin", "win32"]

**Full spec:** https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md

---

### 3. Privacy Policy (Required in TWO places)

**Location 1: manifest.json**
```json
{
  "privacy_policies": [
    "https://your-domain.com/privacy"
  ]
}
```

**Location 2: README.md**
```markdown
## Privacy Policy

This extension accesses public government data from SEC EDGAR. 
No user data is collected, stored, or transmitted.

For complete privacy information: https://your-domain.com/privacy

### Data Practices
- Data accessed: Public SEC filings (no authentication required)
- Data stored: None (stateless queries)
- Data shared: None
- User tracking: None
```

**Requirements:**
- [ ] HTTPS URL (not HTTP)
- [ ] Publicly accessible
- [ ] On your domain (not third-party hosting)
- [ ] Present in BOTH manifest.json AND README.md

**Common rejection:** Privacy policy in one place but not both.

---

### 4. Usage Examples (Minimum 3 Required)

Include in README.md with realistic prompts and expected behavior.

**Example Format:**
```markdown
## Examples

### Example 1: Look Up Company Information
**User prompt:** "Look up Apple's SEC information"

**What happens:**
1. Extension calls `sec_lookup_company` with ticker "AAPL"
2. Returns CIK number, company name, and basic info
3. Ready for follow-up queries about filings

**Expected output:**
- Company: Apple Inc.
- CIK: 0000320193
- Ticker: AAPL

---

### Example 2: Get Recent Filings
**User prompt:** "Show me Tesla's last 5 SEC filings"

**What happens:**
1. Extension calls `sec_get_recent_filings` with identifier "TSLA", limit 5
2. Returns list of recent filings with dates and form types
3. Includes links to full documents

**Expected output:**
- 10-Q filed 2024-10-23
- 8-K filed 2024-10-18
- [etc.]

---

### Example 3: Get Financial Metrics
**User prompt:** "What was Microsoft's revenue last year?"

**What happens:**
1. Extension calls `sec_get_financial_metric` for Revenues
2. Returns annual revenue figures with fiscal year context
3. Includes units (USD) and time period

**Expected output:**
- FY2024 Revenue: $211.9 billion
- Comparison to prior year available
```

**Requirements:**
- [ ] Minimum 3 examples
- [ ] Realistic user prompts
- [ ] Cover different tools/capabilities
- [ ] Show expected behavior and output

---

### 5. Icon (Recommended)

**Specifications:**
- Size: 512×512px (minimum 256×256px)
- Format: PNG with transparency
- Location: Bundle root as `icon.png`

**In manifest.json:**
```json
{
  "icon": "icon.png"
}
```

**Note:** Use `"icon"` (singular string), NOT `"icons"` object.

---

### 6. README.md Structure

**Required sections:**

```markdown
# SEC EDGAR MCP

## Description
Access SEC EDGAR filings, company information, and financial data 
directly from Claude Desktop.

## Features
- Look up companies by ticker or CIK
- Get recent filings (10-K, 10-Q, 8-K, etc.)
- Retrieve financial metrics and time series data
- Compare companies by financial metrics

## Installation
Install from the Anthropic Directory in Claude Desktop:
Settings → Extensions → Browse Directory → SEC EDGAR

## Configuration
No configuration required. This extension accesses public SEC data.

## Examples
[Minimum 3 examples - see section 4]

## Tools

### sec_lookup_company
Look up a company by ticker symbol or CIK number.
- **Parameters:** `ticker` (string) - Stock ticker symbol
- **Returns:** Company name, CIK, and basic information

### sec_get_recent_filings
Get recent SEC filings for a company.
- **Parameters:** 
  - `identifier` (string) - Ticker or CIK
  - `limit` (number, optional) - Max results (default: 10)
- **Returns:** List of filings with dates and form types

[Document all tools]

## Privacy Policy
This extension accesses public government data. No user data is collected.
Full policy: https://your-domain.com/privacy

## Support
- Issues: https://github.com/your-org/sec-edgar-mcp/issues
- Email: support@your-domain.com

## License
MIT
```

**Checklist:**
- [ ] Description
- [ ] Features
- [ ] Installation instructions
- [ ] Configuration (or "none required")
- [ ] 3+ Examples
- [ ] All tools documented
- [ ] Privacy policy section with link
- [ ] Support contact

---

### 7. Build & Package

**Option A: esbuild Bundling (Recommended for JavaScript)**

Bundle all dependencies into a single file—no node_modules needed in the MCPB.

**package.json:**
```json
{
  "scripts": {
    "build": "esbuild server/index.js --bundle --platform=node --target=node18 --outfile=dist/bundle.cjs --format=cjs"
  },
  "devDependencies": {
    "esbuild": "^0.24.0"
  }
}
```

**Build and package:**
```bash
# Install dependencies
npm install

# Bundle with esbuild (creates dist/bundle.cjs with all deps included)
npm run build

# Create MCPB (just zip the essentials)
zip -r your-extension.mcpb \
  manifest.json \
  dist/bundle.cjs \
  icon.png \
  package.json \
  README.md \
  LICENSE \
  CHANGELOG.md
```

**Why esbuild?**
- Bundles all node_modules into single file
- Much smaller MCPB size
- No dependency resolution issues at runtime
- Works offline without npm

---

**Option B: mcpb CLI**

```bash
# Install mcpb globally
npm install -g @anthropic-ai/mcpb

# Clean install production dependencies
rm -rf node_modules
npm install --production

# Build TypeScript (if applicable)
npm run build

# Initialize manifest (if not exists)
mcpb init

# Package bundle
mcpb pack

# Verify package
mcpb info your-extension.mcpb
```

**Output:** `.mcpb` file ready for submission.

---

### 8. Rate Limiting (For API-based MCPs)

If your MCP calls external APIs, implement rate limiting to avoid overwhelming the API and getting blocked.

**Simple rate limiter:**
```javascript
// Rate limiting - 300ms between requests
let lastRequestTime = 0;
const RATE_LIMIT_MS = 300;

async function rateLimitedFetch(url, options = {}) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => 
      setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest)
    );
  }
  
  lastRequestTime = Date.now();
  return fetch(url, options);
}
```

**Usage:**
```javascript
// Use rateLimitedFetch instead of fetch for all API calls
const response = await rateLimitedFetch(
  `https://api.example.com/search?q=${query}`
);
```

**Guidelines:**
- 300ms is a safe default for most public APIs
- Check API documentation for specific rate limits
- Consider exponential backoff for 429 responses

---

### 9. Testing (Required Before Submission)

**Phase 1: Development Testing**
```bash
# Run locally
node dist/index.js

# Test with MCP Inspector
npx @modelcontextprotocol/inspector
```

**Phase 2: Clean Environment Testing**
- Use fresh VM or container
- No development tools installed
- Follow only README instructions
- Verify it works without prior knowledge

**Phase 3: Cross-Platform Testing**
- [ ] Test on macOS
- [ ] Test on Windows
- [ ] Both platforms work identically

**Phase 4: Claude Desktop Testing**
1. Install .mcpb via drag-and-drop or File menu
2. Test all tools in conversation
3. Verify error messages are helpful
4. Check performance is acceptable

---

## Submission Checklist Summary

### Critical (Immediate Rejection if Missing)
- [ ] All tools have `readOnlyHint` AND `destructiveHint` annotations
- [ ] All tools have `title` annotation
- [ ] `manifest_version` is "0.3" or higher
- [ ] `privacy_policies` array in manifest.json
- [ ] Privacy policy section in README.md
- [ ] Minimum 3 usage examples in README.md

### Required
- [ ] Complete manifest.json with all required fields
- [ ] README.md with all required sections
- [ ] Works on both macOS and Windows
- [ ] All dependencies bundled
- [ ] Clean environment testing passed

### Recommended
- [ ] Icon (512×512 PNG)
- [ ] Troubleshooting section in README
- [ ] CHANGELOG.md
- [ ] LICENSE file

---

## Common Rejection Reasons

Based on Anthropic's submission data:

1. **Missing tool annotations** (most common)
   - Fix: Add `readOnlyHint`, `destructiveHint`, `title` to ALL tools

2. **Privacy policy missing from one location**
   - Fix: Must be in BOTH manifest.json AND README.md

3. **Fewer than 3 examples**
   - Fix: Add realistic examples covering core functionality

4. **Portability issues**
   - Fix: Test in clean environment, bundle all dependencies

5. **manifest_version too old**
   - Fix: Use "0.3" or higher for privacy_policies support

---

## After Submission

- Anthropic reviews but cannot guarantee individual responses due to volume
- If selected, they'll reach out for next steps
- Extensions may be removed later for:
  - Quality/reliability issues
  - Policy violations
  - Security concerns
  - User complaints

---

## Key Resources

| Resource | URL |
|----------|-----|
| Submission Form | https://forms.gle/tyiAZvch1kDADKoP9 |
| MCPB Repository | https://github.com/modelcontextprotocol/mcpb |
| Manifest Spec | https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md |
| CLI Documentation | https://github.com/modelcontextprotocol/mcpb/blob/main/CLI.md |
| Examples | https://github.com/modelcontextprotocol/mcpb/tree/main/examples |
| Directory Policy | https://support.claude.com/en/articles/11697096-anthropic-mcp-directory-policy |
| Local Submission Guide | https://support.claude.com/en/articles/12922832-local-mcp-server-submission-guide |
| Building MCPB Guide | https://support.claude.com/en/articles/12922929-building-desktop-extensions-with-mcpb |
| MCP Inspector | https://github.com/modelcontextprotocol/inspector |
| TypeScript SDK | https://github.com/modelcontextprotocol/typescript-sdk |

---

## Quick Reference: Node.js MCPB Template

**package.json (JavaScript + esbuild):**
```json
{
  "name": "sec-edgar-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/bundle.cjs",
  "scripts": {
    "build": "esbuild server/index.js --bundle --platform=node --target=node18 --outfile=dist/bundle.cjs --format=cjs",
    "start": "node dist/bundle.cjs"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "esbuild": "^0.24.0"
  }
}
```

**package.json (TypeScript):**
```json
{
  "name": "sec-edgar-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**Tool with annotations (TypeScript):**
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "sec_lookup_company",
      description: "Look up a company by ticker symbol",
      inputSchema: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "Stock ticker (e.g., AAPL)" }
        },
        required: ["ticker"]
      },
      annotations: {
        title: "Lookup Company",
        readOnlyHint: true,
        destructiveHint: false
      }
    }
  ]
}));
```

---

## Version History

- 2026-01-14: Major update based on World Bank MCP submission:
  - Added structured data output with Zod and `structuredContent`
  - Added esbuild bundling (Option A) as recommended approach
  - Fixed manifest.json: `server` block instead of `runtime`, `icon` instead of `icons`
  - Added rate limiting section for API-based MCPs
  - Updated package.json templates with esbuild and correct SDK version
- 2025-01-13: Initial skill creation for Local MCPB submission
- 2025-01-13: Updated with World Bank MCP conversion
- Sources: Anthropic Local MCP Submission Guide, MCPB Repository, Building Desktop Extensions Guide

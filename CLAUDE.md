# World Bank MCP

MCP server for accessing World Bank Documents & Reports API.

## Project Structure

```
server/index.js    # Main MCP server code
dist/bundle.cjs    # Compiled bundle (esbuild)
manifest.json      # MCPB manifest for Claude Desktop
world-bank-mcp.mcpb # Distributable bundle
```

## Development

```bash
# Install dependencies
npm install

# Build bundle
npm run build

# Create MCPB bundle
zip -r world-bank-mcp.mcpb manifest.json dist/bundle.cjs icon.png package.json README.md LICENSE CHANGELOG.md
```

## Tools

- `wb_search_documents` - Search documents with filters (country, type, date, keywords)
- `wb_get_document` - Get document by ID
- `wb_list_facets` - Get filter values and counts
- `wb_list_countries` - List all countries
- `wb_list_document_types` - List all document types

## API

Uses World Bank Documents & Reports API: `https://search.worldbank.org/api/v3/wds`

No authentication required. Rate limited to 300ms between requests.

## Git Rules

- NEVER commit directly to main
- Create feature branch: `git checkout -b feature/<description>`
- Push feature branch before merging

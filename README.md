# World Bank MCP

Access World Bank Documents & Reports API from Claude Desktop.

## Description

Search and retrieve over 600,000 World Bank documents including working papers, research reports, project documents, procurement plans, and environmental assessments. All data is publicly available—no authentication required.

## Features

- Search documents by country, document type, sector, theme, date range, and keywords
- Get document metadata, abstracts, and PDF links
- List available countries and document types for filtering
- Columnar formatted output for easy reading

## Installation

Install from Claude Desktop:
**Settings → Extensions → Browse Directory → World Bank**

Or install the `.mcpb` bundle directly via **Settings → Extensions → Advanced → Install Extension...**

## Configuration

No configuration required. This extension accesses public World Bank data.

## Examples

### Example 1: Search by Topic and Country

**User prompt:** "Find World Bank documents about renewable energy in Brazil"

**What happens:**
1. Extension calls `wb_search_documents` with query "renewable energy" and country "Brazil"
2. Returns matching documents with titles, dates, and types
3. Includes links to full documents and PDFs

**Expected output:**
- List of documents about renewable energy projects in Brazil
- Document types: Working Papers, Project Reports, Environmental Assessments
- Dates, abstracts, and PDF links included

---

### Example 2: Get Document Details

**User prompt:** "Get me the details for World Bank document 32226131"

**What happens:**
1. Extension calls `wb_get_document` with document_id "32226131"
2. Returns full metadata including abstract and PDF URL
3. Shows document type, date, country, and sector

**Expected output:**
- Full document title and abstract
- Publication date and document type
- Direct link to PDF download

---

### Example 3: Explore Available Document Types

**User prompt:** "What types of World Bank documents are available?"

**What happens:**
1. Extension calls `wb_list_document_types`
2. Returns all document types with counts
3. Sorted by frequency

**Expected output:**
- Procurement Plan (200,000+ documents)
- Implementation Status and Results Report
- Working Paper
- Environmental Assessment
- Project Information Document
- And many more...

---

### Example 4: Search Recent Working Papers

**User prompt:** "Find World Bank working papers on education from 2023"

**What happens:**
1. Extension calls `wb_search_documents` with document_type "Working Paper", query "education", start_date "2023-01-01"
2. Returns matching research papers
3. Sorted by date

**Expected output:**
- Recent academic working papers on education policy
- Authors, abstracts, and publication dates
- Links to full PDF documents

## Tools

### wb_search_documents

Search World Bank documents with comprehensive filters.

**Parameters:**
- `query` (string, optional): Full-text search across title, abstract, and metadata
- `country` (string, optional): Country name (e.g., "Mexico", "India")
- `document_type` (string, optional): Document type (e.g., "Working Paper", "Procurement Plan")
- `theme` (string, optional): Major theme
- `sector` (string, optional): Economic sector (e.g., "Energy", "Education")
- `language` (string, optional): Language (e.g., "English", "Spanish")
- `start_date` (string, optional): Start date filter (YYYY-MM-DD)
- `end_date` (string, optional): End date filter (YYYY-MM-DD)
- `limit` (integer, optional): Results per page (default: 20, max: 100)
- `offset` (integer, optional): Pagination offset

**Returns:** Total count, document list with titles, dates, types, and URLs

### wb_get_document

Get a specific document by ID.

**Parameters:**
- `document_id` (string, required): Document ID (e.g., "32226131")
- `fields` (array, optional): Specific fields to return

**Returns:** Full document metadata including abstract and PDF URL

### wb_list_facets

Get available values for filtering fields.

**Parameters:**
- `facets` (array, required): Field names to get values for (e.g., ["docty_exact", "count_exact"])
- `filter_query` (object, optional): Filter to narrow facet results

**Returns:** Available filter values with document counts

### wb_list_countries

List all countries with document counts.

**Parameters:** None

**Returns:** All countries sorted by document count

### wb_list_document_types

List all document types with counts.

**Parameters:** None

**Returns:** All document types sorted by count

## Privacy Policy

This extension accesses public government/international organization data from the World Bank Documents & Reports API. No user data is collected, stored, or transmitted.

**Data Practices:**
- **Data accessed:** Public World Bank documents (no authentication required)
- **Data stored:** None (stateless queries)
- **Data shared:** None
- **User tracking:** None

For complete privacy information: https://deploycontext.com/privacy

## Troubleshooting

**Extension not responding:**
- Restart Claude Desktop
- Check your internet connection
- The World Bank API may be temporarily unavailable

**No results returned:**
- Try broader search terms
- Check spelling of country or document type names
- Use `wb_list_countries` or `wb_list_document_types` to see valid values

**Rate limiting:**
- The extension includes built-in rate limiting (300ms between requests)
- If you see errors, wait a moment and try again

## Support

- **Issues:** https://github.com/DeployContext/world-bank/issues
- **Email:** support@deploycontext.com

## License

MIT

## Links

- [World Bank Documents & Reports](https://documents.worldbank.org/)
- [API Documentation](https://search.worldbank.org/api/v3/wds)
- [DeployContext](https://deploycontext.com)

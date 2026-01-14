# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-14

### Added

- Initial public release
- `wb_search_documents` - Search World Bank documents with filters (country, document type, sector, theme, date range, keywords)
- `wb_get_document` - Get specific document by ID with metadata
- `wb_list_facets` - Get available filter values and counts
- `wb_list_countries` - List all countries with document counts
- `wb_list_document_types` - List all document types with counts
- Columnar table formatting for human-readable output
- Rate limiting (300ms between requests) to respect API limits
- MCPB bundle for easy Claude Desktop installation

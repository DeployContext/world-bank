#!/usr/bin/env node

/**
 * World Bank Documents & Reports MCP Server
 * 
 * MCPB-compatible stdio server for World Bank Documents & Reports API.
 * Uses @modelcontextprotocol/sdk with stdio transport.
 * Returns both formatted text and structured data.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const API_BASE_URL = 'https://search.worldbank.org/api/v3/wds';
const SERVER_NAME = 'world-bank-mcp';
const VERSION = '1.0.0';

// Rate limiting: 300ms delay between requests (no documented rate limit, but 200-500ms recommended)
let lastRequestTime = 0;
const RATE_LIMIT_DELAY = 300; // milliseconds

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
  }
  lastRequestTime = Date.now();
}

async function fetchFromAPI(params) {
  await rateLimit();
  
  const queryParams = new URLSearchParams();
  queryParams.set('format', 'json');
  
  // Add all non-undefined parameters
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        queryParams.set(key, value.join(','));
      } else {
        queryParams.set(key, value);
      }
    }
  }
  
  const url = `${API_BASE_URL}?${queryParams.toString()}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

// Zod schemas for structured output
const DocumentSchema = z.object({
  id: z.string(),
  display_title: z.string(),
  docty: z.string().optional(),
  count: z.string().optional(),
  docdt: z.string().optional(),
  url: z.string().optional(),
  pdfurl: z.string().optional(),
  abstracts: z.object({
    cdata: z.string()
  }).optional()
});

const SearchResultsSchema = z.object({
  total: z.number(),
  rows: z.number(),
  page: z.number(),
  documents: z.array(DocumentSchema)
});

const CountrySchema = z.object({
  name: z.string(),
  label: z.string(),
  count: z.number()
});

const DocumentTypeSchema = z.object({
  name: z.string(),
  label: z.string(),
  count: z.number()
});

const FacetSchema = z.object({
  name: z.string(),
  count: z.number()
});

// Tool definitions
const TOOLS = [
  {
    name: 'wb_search_documents',
    description: `Search World Bank documents with comprehensive filters.

WHEN TO USE:
- Search documents by keywords or full-text query
- Filter by country, document type, theme, or sector
- Search within date ranges
- Combine multiple filters for precise queries

PARAMETERS:
- query (string, optional): Full-text search query across title, abstract, and metadata
- country (string, optional): Filter by country name (exact match, e.g., "Mexico", "India")
- document_type (string, optional): Filter by document type (exact match, e.g., "Procurement Plan", "Working Paper")
- theme (string, optional): Filter by major theme (exact match, e.g., "FY17 - Urban and Rural Development")
- sector (string, optional): Filter by economic sector (exact match, e.g., "Energy", "Education")
- language (string, optional): Filter by language (exact match, e.g., "English", "Spanish")
- start_date (string, optional): Filter documents from this date onwards (YYYY-MM-DD format)
- end_date (string, optional): Filter documents up to this date (YYYY-MM-DD format)
- limit (integer, optional): Number of results per page (default: 20, max: 100)
- offset (integer, optional): Pagination offset (default: 0)
- fields (array, optional): Fields to return (e.g., ["docdt", "abstracts", "pdfurl"]). Always returns id, display_title, url
- sort_by (string, optional): Sort field - one of: "docdt" (date), "docna" (document name), "docty" (document type), "repnb" (report number)
- sort_order (string, optional): Sort order - "asc" or "desc" (default: "desc" for dates)

EXAMPLES:
- Basic search: { "query": "renewable energy" }
- By country: { "country": "Mexico", "limit": 20 }
- By document type: { "document_type": "Procurement Plan", "start_date": "2020-01-01" }
- Combined filters: { "query": "education", "country": "India", "document_type": "Working Paper", "start_date": "2020-01-01" }
- With pagination: { "country": "Brazil", "limit": 50, "offset": 100 }

RETURNS: Columnar table display + structured JSON data with total count, rows, page, and documents array`,

    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Full-text search query across title, abstract, and metadata'
        },
        country: {
          type: 'string',
          description: 'Country name (exact match, e.g., "Mexico", "India", "Brazil")'
        },
        document_type: {
          type: 'string',
          description: 'Document type (exact match, e.g., "Procurement Plan", "Working Paper", "Environmental Assessment")'
        },
        theme: {
          type: 'string',
          description: 'Major theme (exact match, e.g., "FY17 - Urban and Rural Development")'
        },
        sector: {
          type: 'string',
          description: 'Economic sector (exact match, e.g., "Energy", "Education", "Health")'
        },
        language: {
          type: 'string',
          description: 'Language (exact match, e.g., "English", "Spanish", "French")'
        },
        start_date: {
          type: 'string',
          description: 'Start date filter (YYYY-MM-DD format)'
        },
        end_date: {
          type: 'string',
          description: 'End date filter (YYYY-MM-DD format)'
        },
        limit: {
          type: 'integer',
          description: 'Number of results per page (default: 20, max: 100)',
          minimum: 1,
          maximum: 100
        },
        offset: {
          type: 'integer',
          description: 'Pagination offset (default: 0)',
          minimum: 0
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to return (e.g., ["docdt", "abstracts", "pdfurl", "docty", "count"]). Always returns id, display_title, url'
        },
        sort_by: {
          type: 'string',
          enum: ['docdt', 'docna', 'docty', 'repnb'],
          description: 'Field to sort by (default: docdt for date-based queries, relevance for text queries)'
        },
        sort_order: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order (default: desc for dates)'
        }
      }
    },
    annotations: {
      title: 'Search World Bank Documents',
      readOnlyHint: true,
      destructiveHint: false
    }
  },
  {
    name: 'wb_get_document',
    description: `Get a specific World Bank document by ID.

WHEN TO USE:
- Retrieve detailed information about a specific document
- Get full document metadata including abstract and PDF URL
- Look up document by known ID

PARAMETERS:
- document_id (string, required): Document ID (numeric string, e.g., "11831032")
- fields (array, optional): Fields to return. Always returns id, display_title, url

EXAMPLES:
- Get full document: { "document_id": "11831032" }
- Get specific fields: { "document_id": "11831032", "fields": ["docdt", "abstracts", "pdfurl", "docty", "count"] }

RETURNS: Document object with requested fields + formatted display`,

    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Document ID (numeric string, e.g., "11831032")'
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to return (e.g., ["docdt", "abstracts", "pdfurl", "docty", "count"]). Always returns id, display_title, url'
        }
      },
      required: ['document_id']
    },
    annotations: {
      title: 'Get World Bank Document',
      readOnlyHint: true,
      destructiveHint: false
    }
  },
  {
    name: 'wb_list_facets',
    description: `Get available values and counts for filtering fields.

WHEN TO USE:
- Discover available values for filters (countries, document types, themes, etc.)
- Validate filter values before using them
- Get counts of documents matching each value
- Build filter UI or autocomplete suggestions

PARAMETERS:
- facets (array, required): Field names to facet (e.g., ["count_exact", "docty_exact", "lang_exact", "majtheme_exact", "sectr_exact"])
- filter_query (object, optional): Query to filter documents before faceting (same parameters as wb_search_documents, but only used for filtering)

EXAMPLES:
- List countries: { "facets": ["count_exact"] }
- List document types: { "facets": ["docty_exact"] }
- List languages: { "facets": ["lang_exact"] }
- Filtered facets: { "facets": ["docty_exact"], "filter_query": { "country": "Mexico" } }
- Multiple facets: { "facets": ["count_exact", "docty_exact", "lang_exact"] }

RETURNS: Columnar table display + structured facet data`,

    inputSchema: {
      type: 'object',
      properties: {
        facets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Field names to facet (e.g., ["count_exact", "docty_exact", "lang_exact", "majtheme_exact", "sectr_exact"])'
        },
        filter_query: {
          type: 'object',
          description: 'Query to filter documents before faceting (same parameters as wb_search_documents)',
          properties: {
            query: { type: 'string' },
            country: { type: 'string' },
            document_type: { type: 'string' },
            theme: { type: 'string' },
            sector: { type: 'string' },
            language: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' }
          }
        }
      },
      required: ['facets']
    },
    annotations: {
      title: 'List Filter Facets',
      readOnlyHint: true,
      destructiveHint: false
    }
  },
  {
    name: 'wb_list_countries',
    description: `Get list of all available countries with document counts.

WHEN TO USE:
- Discover available countries
- Get country names for use in search filters
- See document counts per country
- Validate country names before searching

PARAMETERS:
None

EXAMPLES:
- List all countries: {}

RETURNS: Columnar table display + structured countries array`,

    inputSchema: {
      type: 'object',
      properties: {}
    },
    annotations: {
      title: 'List Countries',
      readOnlyHint: true,
      destructiveHint: false
    }
  },
  {
    name: 'wb_list_document_types',
    description: `Get list of all available document types with counts.

WHEN TO USE:
- Discover available document types
- Get document type names for use in search filters
- See document counts per type
- Understand what types of documents are available

PARAMETERS:
None

EXAMPLES:
- List all document types: {}

RETURNS: Columnar table display + structured document types array`,

    inputSchema: {
      type: 'object',
      properties: {}
    },
    annotations: {
      title: 'List Document Types',
      readOnlyHint: true,
      destructiveHint: false
    }
  }
];

// Utility functions for columnar formatting
function pad(str, length, right = false) {
  str = String(str || '').substring(0, length);
  if (right) {
    return str.padEnd(length, ' ');
  } else {
    return str.padStart(length, ' ');
  }
}

function formatTable(rows, columns) {
  if (rows.length === 0) {
    return 'No results found.';
  }

  // Calculate column widths
  const widths = {};
  columns.forEach(col => {
    widths[col] = Math.max(
      col.length,
      Math.max(...rows.map(row => String(row[col] || '').length))
    );
  });

  // Build header
  const header = columns.map(col => pad(col, widths[col], true)).join(' | ');
  const separator = columns.map(col => '─'.repeat(widths[col])).join('─┼─');

  // Build rows
  const formattedRows = rows.map(row =>
    columns.map(col => pad(String(row[col] || ''), widths[col], true)).join(' | ')
  );

  return [header, separator, ...formattedRows].join('\n');
}

function truncate(str, length = 60) {
  if (!str) return '';
  str = String(str).replace(/\n/g, ' ');
  return str.length > length ? str.substring(0, length - 3) + '...' : str;
}

function formatCountryTable(countries) {
  const rows = countries.map(c => ({
    Name: c.name,
    Count: c.count.toLocaleString()
  }));
  return formatTable(rows, ['Name', 'Count']);
}

function formatDocumentTypeTable(types) {
  const rows = types.map(t => ({
    'Document Type': truncate(t.name, 40),
    Count: t.count.toLocaleString()
  }));
  return formatTable(rows, ['Document Type', 'Count']);
}

function formatSearchResultsTable(documents, limit = 50) {
  const rows = documents.map(doc => ({
    ID: doc.id,
    Title: truncate(doc.display_title, limit),
    Type: truncate(doc.docty, 25),
    Country: truncate(doc.count, 20),
    Date: doc.docdt ? new Date(doc.docdt).toISOString().split('T')[0] : ''
  }));
  return formatTable(rows, ['ID', 'Title', 'Type', 'Country', 'Date']);
}

function formatFacetTable(facetData, facetName) {
  const rows = Object.values(facetData).map(item => ({
    Name: truncate(item.name, 40),
    Count: item.count.toLocaleString()
  }));
  return formatTable(rows, ['Name', 'Count']);
}

// Tool handler functions
async function handleSearchDocuments(args) {
  const params = {};
  
  if (args.query) params.qterm = args.query;
  if (args.country) params.count_exact = args.country;
  if (args.document_type) params.docty_exact = args.document_type;
  if (args.theme) params.majtheme_exact = args.theme;
  if (args.sector) params.sectr_exact = args.sector;
  if (args.language) params.lang_exact = args.language;
  if (args.start_date) params.strdate = args.start_date;
  if (args.end_date) params.enddate = args.end_date;
  if (args.limit !== undefined) params.rows = args.limit;
  if (args.offset !== undefined) params.os = args.offset;
  if (args.fields && Array.isArray(args.fields) && args.fields.length > 0) {
    params.fl = args.fields.join(',');
  }
  if (args.sort_by) params.sort = args.sort_by;
  if (args.sort_order) params.order = args.sort_order;
  
  const apiResponse = await fetchFromAPI(params);
  
  // Convert documents object to array
  const documents = [];
  if (apiResponse.documents) {
    for (const key in apiResponse.documents) {
      if (key !== 'facets' && key.startsWith('D')) {
        documents.push(apiResponse.documents[key]);
      }
    }
  }
  
  return {
    total: apiResponse.total || 0,
    rows: apiResponse.rows || documents.length,
    page: apiResponse.page || 1,
    documents
  };
}

async function handleGetDocument(args) {
  if (!args.document_id) {
    throw new Error('Missing required parameter: document_id');
  }
  
  const params = {
    id: args.document_id,
    rows: 1
  };
  
  if (args.fields && Array.isArray(args.fields) && args.fields.length > 0) {
    params.fl = args.fields.join(',');
  }
  
  const apiResponse = await fetchFromAPI(params);
  
  // Find the document (key is D{document_id})
  let document = null;
  if (apiResponse.documents) {
    const docKey = `D${args.document_id}`;
    document = apiResponse.documents[docKey] || null;
    
    // If not found by key, search for it
    if (!document) {
      for (const key in apiResponse.documents) {
        if (key !== 'facets' && key.startsWith('D')) {
          const doc = apiResponse.documents[key];
          if (doc.id === args.document_id) {
            document = doc;
            break;
          }
        }
      }
    }
  }
  
  if (!document) {
    throw new Error(`Document not found: ${args.document_id}`);
  }
  
  return { document };
}

async function handleListFacets(args) {
  if (!args.facets || !Array.isArray(args.facets) || args.facets.length === 0) {
    throw new Error('Missing required parameter: facets');
  }
  
  const params = {
    fct: args.facets.join(','),
    rows: 0 // Get facets only, no documents
  };
  
  // Add filter query parameters if provided
  if (args.filter_query) {
    const filter = args.filter_query;
    if (filter.query) params.qterm = filter.query;
    if (filter.country) params.count_exact = filter.country;
    if (filter.document_type) params.docty_exact = filter.document_type;
    if (filter.theme) params.majtheme_exact = filter.theme;
    if (filter.sector) params.sectr_exact = filter.sector;
    if (filter.language) params.lang_exact = filter.language;
    if (filter.start_date) params.strdate = filter.start_date;
    if (filter.end_date) params.enddate = filter.end_date;
  }
  
  const apiResponse = await fetchFromAPI(params);
  
  return {
    facets: apiResponse.documents?.facets || {}
  };
}

async function handleListCountries() {
  const params = {
    fct: 'count_exact',
    rows: 0
  };
  
  const apiResponse = await fetchFromAPI(params);
  
  // Convert facets object to array
  const countries = [];
  const facets = apiResponse.documents?.facets?.count_exact || {};
  for (const key in facets) {
    countries.push(facets[key]);
  }
  
  // Sort by count descending
  countries.sort((a, b) => (b.count || 0) - (a.count || 0));
  
  return { countries };
}

async function handleListDocumentTypes() {
  const params = {
    fct: 'docty_exact',
    rows: 0
  };
  
  const apiResponse = await fetchFromAPI(params);
  
  // Convert facets object to array
  const documentTypes = [];
  const facets = apiResponse.documents?.facets?.docty_exact || {};
  for (const key in facets) {
    documentTypes.push(facets[key]);
  }
  
  // Sort by count descending
  documentTypes.sort((a, b) => (b.count || 0) - (a.count || 0));
  
  return { document_types: documentTypes };
}

// Create MCP server
const server = new Server(
  {
    name: SERVER_NAME,
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle call tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    let result;
    let formattedOutput = '';
    let structuredContent = {};
    
    switch (name) {
      case 'wb_search_documents':
        result = await handleSearchDocuments(args || {});
        formattedOutput = `Search Results: ${result.total.toLocaleString()} documents found (showing ${result.rows})\n\n`;
        formattedOutput += formatSearchResultsTable(result.documents);
        structuredContent = result;
        break;
      case 'wb_get_document':
        result = await handleGetDocument(args || {});
        const doc = result.document;
        formattedOutput = `Document: ${doc.display_title}\n\n`;
        formattedOutput += `ID:      ${doc.id}\n`;
        formattedOutput += `Type:    ${doc.docty || 'N/A'}\n`;
        formattedOutput += `Date:    ${doc.docdt ? new Date(doc.docdt).toISOString().split('T')[0] : 'N/A'}\n`;
        formattedOutput += `URL:     ${doc.url || doc.pdfurl || 'N/A'}\n`;
        if (doc.abstracts?.cdata) {
          formattedOutput += `\nAbstract:\n${doc.abstracts.cdata.substring(0, 500)}...\n`;
        }
        structuredContent = result;
        break;
      case 'wb_list_facets':
        result = await handleListFacets(args || {});
        formattedOutput = 'Filter Options (Facets)\n\n';
        for (const [facetName, facetData] of Object.entries(result.facets)) {
          formattedOutput += `${facetName}:\n`;
          formattedOutput += formatFacetTable(facetData, facetName) + '\n\n';
        }
        structuredContent = result;
        break;
      case 'wb_list_countries':
        result = await handleListCountries();
        formattedOutput = 'Available Countries and Document Counts\n\n';
        formattedOutput += formatCountryTable(result.countries);
        structuredContent = result;
        break;
      case 'wb_list_document_types':
        result = await handleListDocumentTypes();
        formattedOutput = 'Available Document Types and Counts\n\n';
        formattedOutput += formatDocumentTypeTable(result.document_types);
        structuredContent = result;
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: formattedOutput,
        },
      ],
      structuredContent: structuredContent,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message || 'Internal server error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${VERSION} connected via stdio`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

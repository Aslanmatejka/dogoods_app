#!/usr/bin/env node

/**
 * Supabase MCP Server
 * Provides Model Context Protocol access to Supabase database operations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// MCP Server setup
const server = new Server(
  {
    name: 'dogoods-supabase-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Database schema information
const TABLES = {
  users: {
    description: 'User profiles and authentication data',
    columns: ['id', 'email', 'name', 'avatar_url', 'is_admin', 'created_at', 'updated_at'],
  },
  food_listings: {
    description: 'Available food items for sharing',
    columns: ['id', 'user_id', 'title', 'description', 'category', 'quantity', 'unit', 'expiry_date', 'image_url', 'status', 'created_at'],
  },
  food_claims: {
    description: 'Claims made on food listings',
    columns: ['id', 'food_id', 'user_id', 'status', 'members_count', 'created_at', 'updated_at'],
  },
  community_posts: {
    description: 'Community discussion posts',
    columns: ['id', 'user_id', 'title', 'content', 'category', 'created_at', 'updated_at'],
  },
  feedback: {
    description: 'User feedback submissions',
    columns: ['id', 'user_id', 'category', 'message', 'status', 'created_at'],
  },
};

// Tool: Query Database
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'query_table',
        description: 'Query data from a Supabase table with filtering and ordering',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Table name to query',
              enum: Object.keys(TABLES),
            },
            select: {
              type: 'string',
              description: 'Columns to select (default: "*")',
              default: '*',
            },
            filter: {
              type: 'object',
              description: 'Filter conditions as key-value pairs (equality only)',
              additionalProperties: true,
            },
            orderBy: {
              type: 'object',
              properties: {
                column: { type: 'string' },
                ascending: { type: 'boolean', default: true },
              },
            },
            limit: {
              type: 'number',
              description: 'Maximum number of rows to return',
              default: 100,
            },
          },
          required: ['table'],
        },
      },
      {
        name: 'insert_record',
        description: 'Insert a new record into a Supabase table',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Table name',
              enum: Object.keys(TABLES),
            },
            data: {
              type: 'object',
              description: 'Record data to insert',
              additionalProperties: true,
            },
          },
          required: ['table', 'data'],
        },
      },
      {
        name: 'update_record',
        description: 'Update records in a Supabase table',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Table name',
              enum: Object.keys(TABLES),
            },
            filter: {
              type: 'object',
              description: 'Filter conditions to identify records to update',
              additionalProperties: true,
            },
            data: {
              type: 'object',
              description: 'Updated data',
              additionalProperties: true,
            },
          },
          required: ['table', 'filter', 'data'],
        },
      },
      {
        name: 'delete_record',
        description: 'Delete records from a Supabase table',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Table name',
              enum: Object.keys(TABLES),
            },
            filter: {
              type: 'object',
              description: 'Filter conditions to identify records to delete',
              additionalProperties: true,
            },
          },
          required: ['table', 'filter'],
        },
      },
      {
        name: 'count_records',
        description: 'Count records in a Supabase table with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Table name',
              enum: Object.keys(TABLES),
            },
            filter: {
              type: 'object',
              description: 'Filter conditions',
              additionalProperties: true,
            },
          },
          required: ['table'],
        },
      },
      {
        name: 'get_table_schema',
        description: 'Get schema information for a table',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Table name',
              enum: Object.keys(TABLES),
            },
          },
          required: ['table'],
        },
      },
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'query_table': {
        let query = supabase.from(args.table).select(args.select || '*');

        // Apply filters
        if (args.filter) {
          for (const [key, value] of Object.entries(args.filter)) {
            query = query.eq(key, value);
          }
        }

        // Apply ordering
        if (args.orderBy) {
          query = query.order(args.orderBy.column, { ascending: args.orderBy.ascending ?? true });
        }

        // Apply limit
        if (args.limit) {
          query = query.limit(args.limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data, count: data?.length || 0 }, null, 2),
            },
          ],
        };
      }

      case 'insert_record': {
        const { data, error } = await supabase.from(args.table).insert(args.data).select();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data }, null, 2),
            },
          ],
        };
      }

      case 'update_record': {
        let query = supabase.from(args.table).update(args.data);

        // Apply filters
        if (args.filter) {
          for (const [key, value] of Object.entries(args.filter)) {
            query = query.eq(key, value);
          }
        }

        const { data, error } = await query.select();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data, updated: data?.length || 0 }, null, 2),
            },
          ],
        };
      }

      case 'delete_record': {
        let query = supabase.from(args.table);

        // Apply filters
        if (args.filter) {
          for (const [key, value] of Object.entries(args.filter)) {
            query = query.eq(key, value);
          }
        }

        const { data, error } = await query.delete().select();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, deleted: data?.length || 0 }, null, 2),
            },
          ],
        };
      }

      case 'count_records': {
        let query = supabase.from(args.table).select('*', { count: 'exact', head: true });

        // Apply filters
        if (args.filter) {
          for (const [key, value] of Object.entries(args.filter)) {
            query = query.eq(key, value);
          }
        }

        const { count, error } = await query;

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, count }, null, 2),
            },
          ],
        };
      }

      case 'get_table_schema': {
        const tableInfo = TABLES[args.table];

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, schema: tableInfo }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Resource listing handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: Object.entries(TABLES).map(([name, info]) => ({
      uri: `supabase://tables/${name}`,
      name: `Table: ${name}`,
      description: info.description,
      mimeType: 'application/json',
    })),
  };
});

// Resource reading handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^supabase:\/\/tables\/(.+)$/);

  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const tableName = match[1];
  const tableInfo = TABLES[tableName];

  if (!tableInfo) {
    throw new Error(`Unknown table: ${tableName}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(tableInfo, null, 2),
      },
    ],
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ Supabase MCP Server running on stdio');
}

main().catch((error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

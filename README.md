# mcp-opendosm-my

data.gov.my / OpenDOSM (Department of Statistics Malaysia) — official Malaysian open-data API.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `opendosm_get_dataset` | Fetch records from an official Malaysian statistics dataset (data.gov.my / OpenDOSM, Dept of Statistics Malaysia). Keyless, authoritative. The dataset `id` is REQUIRED — there is no listing endpoint, so use opendosm_list_datasets or opendosm_dataset_meta to discover ids and their columns. Verified high-value ids: |
| `opendosm_dataset_meta` | Metadata for one Malaysian dataset (data.gov.my): catalogue_id, data_as_of, last_updated, next_update, data_source, update_frequency, plus a sample row showing the available columns. Use this to inspect a series before pulling it, or to check freshness. Requires a dataset id. |
| `opendosm_list_datasets` | List the curated, verified high-value datasets available from data.gov.my / OpenDOSM (Dept of Statistics Malaysia). data.gov.my exposes no machine listing/search endpoint, so this returns a hand-verified set covering inflation, GDP, labour, prices, income, population and demography, with each dataset id, topic, description and its value columns. Optionally filter by topic. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "opendosm-my": {
      "url": "https://gateway.pipeworx.io/opendosm-my/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Opendosm My data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

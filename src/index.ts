interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * data.gov.my / OpenDOSM (Department of Statistics Malaysia) — official Malaysian open-data API.
 * Keyless. Source: https://developer.data.gov.my/realtime-api/data-catalogue
 */


const BASE = 'https://api.data.gov.my/data-catalogue/';
const UA = 'pipeworx-mcp-opendosm-my/1.0 (+https://pipeworx.io)';

// Curated, curl-verified dataset ids. There is no public catalogue-listing endpoint,
// so these are hand-verified high-value series. Each entry: id, one-line description,
// and the value columns the records expose.
const KNOWN_DATASETS = [
  { id: 'cpi_headline', topic: 'inflation', description: 'Headline Consumer Price Index, monthly (1980–present).', columns: ['date', 'index', 'division'] },
  { id: 'cpi_core', topic: 'inflation', description: 'Core CPI (excludes volatile items), monthly.', columns: ['date', 'index', 'division'] },
  { id: 'gdp_qtr_real', topic: 'gdp', description: 'Real GDP, quarterly (constant 2015 prices).', columns: ['date', 'value', 'series'] },
  { id: 'economic_indicators', topic: 'gdp', description: 'Leading / coincident / lagging economic indicator indices, monthly.', columns: ['date', 'leading', 'coincident', 'lagging', 'leading_diffusion', 'coincident_diffusion'] },
  { id: 'ipi', topic: 'industry', description: 'Industrial Production Index, monthly (seasonally adjusted + absolute).', columns: ['date', 'index', 'index_sa', 'series'] },
  { id: 'lfs_month', topic: 'labour', description: 'Labour force survey, monthly: unemployment rate, participation rate, employment.', columns: ['date', 'lf', 'lf_employed', 'lf_unemployed', 'u_rate', 'p_rate', 'ep_ratio'] },
  { id: 'fuelprice', topic: 'prices', description: 'Weekly retail fuel prices (RON95, RON97, diesel) in MYR per litre.', columns: ['date', 'ron95', 'ron97', 'diesel', 'series_type'] },
  { id: 'hh_income', topic: 'income', description: 'Household income: mean and median (MYR), by survey year.', columns: ['date', 'income_mean', 'income_median'] },
  { id: 'population_malaysia', topic: 'population', description: 'Malaysia population by age / sex / ethnicity (thousands), annual.', columns: ['date', 'age', 'sex', 'ethnicity', 'population'] },
  { id: 'population_state', topic: 'population', description: 'Population by state, age, sex, ethnicity (thousands).', columns: ['date', 'state', 'age', 'sex', 'ethnicity', 'population'] },
  { id: 'births', topic: 'demography', description: 'Live births by state and date.', columns: ['date', 'state', 'births'] },
  { id: 'deaths', topic: 'demography', description: 'Deaths: absolute count and crude rate, annual.', columns: ['date', 'abs', 'rate'] },
] as const;

const KNOWN_IDS = KNOWN_DATASETS.map((d) => `${d.id} (${d.description})`).join('; ');

const tools: McpToolExport['tools'] = [
  {
    name: 'opendosm_get_dataset',
    description:
      'Fetch records from an official Malaysian statistics dataset (data.gov.my / OpenDOSM, Dept of Statistics Malaysia). ' +
      'Keyless, authoritative. The dataset `id` is REQUIRED — there is no listing endpoint, so use opendosm_list_datasets ' +
      'or opendosm_dataset_meta to discover ids and their columns. ' +
      'Verified high-value ids: ' + KNOWN_IDS + '. ' +
      'Filter syntax is value@column (e.g. filter="overall@division" keeps only rows where division=overall). ' +
      'Range syntax is column[start:end] on NUMERIC columns only, either bound optional (e.g. range="index[130:140]", range="index[135:]"). ' +
      'Date ranges are NOT supported by `range`; instead use sort="-date" with limit to get the most recent rows. ' +
      'sort="-col" is descending, sort="col" ascending.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Dataset id, e.g. "cpi_headline", "lfs_month", "fuelprice". Required.' },
        filter: { type: 'string', description: 'Exact-match filter, format value@column, e.g. "overall@division".' },
        range: { type: 'string', description: 'Numeric range, format column[start:end] (bounds optional), e.g. "index[130:140]". Numeric columns only — not dates.' },
        sort: { type: 'string', description: 'Sort column; prefix "-" for descending, e.g. "-date" for newest first.' },
        limit: { type: 'integer', description: 'Max records to return. Omit for full series (can be large).' },
      },
      required: ['id'],
    },
  },
  {
    name: 'opendosm_dataset_meta',
    description:
      'Metadata for one Malaysian dataset (data.gov.my): catalogue_id, data_as_of, last_updated, next_update, ' +
      'data_source, update_frequency, plus a sample row showing the available columns. Use this to inspect a series ' +
      'before pulling it, or to check freshness. Requires a dataset id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Dataset id, e.g. "cpi_headline". Required.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'opendosm_list_datasets',
    description:
      'List the curated, verified high-value datasets available from data.gov.my / OpenDOSM (Dept of Statistics Malaysia). ' +
      'data.gov.my exposes no machine listing/search endpoint, so this returns a hand-verified set covering inflation, GDP, ' +
      'labour, prices, income, population and demography, with each dataset id, topic, description and its value columns. ' +
      'Optionally filter by topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Optional topic filter, e.g. "inflation", "labour", "population", "gdp", "prices", "income", "demography", "industry".' },
      },
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'opendosm_get_dataset': {
      const id = reqStr(args, 'id', '"cpi_headline"');
      const params = new URLSearchParams({ id });
      const filter = optStr(args, 'filter');
      const range = optStr(args, 'range');
      const sort = optStr(args, 'sort');
      if (filter) params.set('filter', filter);
      if (range) params.set('range', range);
      if (sort) params.set('sort', sort);
      if (typeof args.limit === 'number' && Number.isFinite(args.limit)) params.set('limit', String(Math.trunc(args.limit)));
      return apiGet(params);
    }
    case 'opendosm_dataset_meta': {
      const id = reqStr(args, 'id', '"cpi_headline"');
      const params = new URLSearchParams({ id, meta: 'true', limit: '1' });
      return apiGet(params);
    }
    case 'opendosm_list_datasets': {
      const topic = optStr(args, 'topic')?.toLowerCase();
      const datasets = topic ? KNOWN_DATASETS.filter((d) => d.topic === topic) : KNOWN_DATASETS;
      return {
        note: 'data.gov.my has no catalogue-listing endpoint; this is a curated, curl-verified set. Pass an id to opendosm_get_dataset.',
        count: datasets.length,
        datasets,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function apiGet(params: URLSearchParams): Promise<unknown> {
  const res = await fetch(`${BASE}?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`data.gov.my: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  return v.trim();
}

function optStr(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;

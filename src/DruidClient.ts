import { randomUUID } from 'crypto'
import fetch from 'node-fetch'

import { SQLParameter } from './sql/types'
import { sql, SubSQL } from './sql/sql'

type AuthParams = {
  username: string;
  password: string;
}

type QueryContext = {
  // TODO: this
}

type SQLQueryContext = QueryContext & {
  /**
   * Whether to use [approximate TopN](https://druid.apache.org/docs/latest/querying/topnquery.html)
   * queries when a SQL query could be expressed as such.
   * If false, exact [GroupBy queries](https://druid.apache.org/docs/latest/querying/groupbyquery.html) will be used instead.
   */
  useApproximateTopN?: boolean;
  /**
   * Whether to use an approximate cardinality algorithm for COUNT(DISTINCT foo).
   * @default true
   */
  useApproximateCountDistinct?: boolean;
  /**
   * Sets the time zone for this connection, which will affect how time functions and timestamp literals behave.
   * Should be a time zone name like "America/Los_Angeles" or offset like "-08:00".
   * @default 'UTC'
   */
  sqlTimeZone?: string;
  /**
   * Unique identifier given to this SQL query.
   * Note that to specify an unique identifier for SQL query, use sqlQueryId instead of queryId
   * @default auto-generated
   */
  sqlQueryId?: string;
}

type DruidClientOptions = {
  port?: number;
  tls?: boolean;
  auth?: AuthParams;
}

type NativeQuery = {
  queryId?: string;
  /**
   * @see https://druid.apache.org/docs/latest/querying/query-context.html
   */
  context?: QueryContext;
  /**
   * This is the first thing Apache Druid looks at to figure out how to interpret the query.
   */
  queryType: string; // TODO: queryType type
  /**
   * A String or Object defining the data source to query, very similar to a table in a relational database.
   * @see https://druid.apache.org/docs/latest/querying/datasource.html
   */
  datasource: string;
  /**
   * An integer that limits the number of results.
   */
  limit?: number;
  /**
   * Whether to make descending ordered result.
   * @default false
   */
  descending?: boolean;
  /**
   * A JSON Object representing ISO-8601 Intervals. This defines the time ranges to run the query over.
   */
  intervals: object; // TODO: interval type
  /**
   * granularity
   */
  granularity: string; // TODO: granularity type
  filter?: object; // TODO: filter type
  aggregations?: object; // TODO: aggregations type
  postAggregations?: object; // TODO: postAggregations type
}

type SQLQuery = {
  query: string;
  parameters?: SQLParameter[];
}

type SQLQueryOptions = {
  /**
   * Druid SQL supports setting connection parameters on the client. The parameters under SQLContextParams affect SQL planning.
   * All other context parameters you provide will be attached to Druid queries and can affect how they run.
   * see See @see QueryContext for details on the possible options.
   * @see https://druid.apache.org/docs/latest/querying/sql.html#connection-context
   */
  context?: SQLQueryContext;
  /**
   * Whether or not to include a header (i.e.: column names).
   * @default false
   */
  header?: boolean;
}

type NativeQueryResponse = Promise<any> & { cancel: () => Promise<any>; }

type SQLQueryResponse = Array<any> & { sqlQueryId: string; }

const isSQLQuery = (query: any): query is SQLQuery => typeof query?.query === 'string'

class DruidClient {
  private endpoint: string
  private sqlEndpoint: string
  private headers: { [key: string]: string; }

  constructor(host: string, options?: DruidClientOptions) {
    const protocol = options?.tls ? 'https' : 'http'
    const clientPort = options?.port ?? options?.tls ? 8282 : 8082

    this.endpoint = `${protocol}://${host}:${clientPort}/druid/v2`
    this.sqlEndpoint = `${this.endpoint}/sql`
    this.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }

    // Only Basic auth
    if (options?.auth) {
      const { username, password } = options.auth
      const token = Buffer.from(`${username}:${password}`).toString('base64')
      this.headers.Authorization = `Basic ${token}`
    }
  }

  /**
   * Perform a cancelable Druid native query.
   * @param {object} query A valid Druid native query. @see https://druid.apache.org/docs/latest/querying/querying.
   */
  async query(query: NativeQuery): Promise<NativeQueryResponse>

  /**
   * Druid SQL translates SQL queries to native queries before running them, and understanding how this translation works is key to getting good performance.
   * @see https://druid.apache.org/docs/latest/querying/sql.html#query-translation
   *
   * Some Druid features are not available using SQL queries @see https://druid.apache.org/docs/latest/querying/sql.html#unsupported-features
   * @param query SQL query.
   * @param queryOptions query options parameters. @see https://druid.apache.org/docs/latest/querying/sql.html#dynamic-parameters
   * @param opts.context Druid SQL query context. @see https://druid.apache.org/docs/latest/querying/sql.html#connection-context
   *
   */
  async query(query: SQLQuery, queryOptions?: SQLQueryOptions): Promise<SQLQueryResponse>

  query(query: NativeQuery | SQLQuery, queryOptions?: SQLQueryOptions): Promise<NativeQueryResponse | SQLQueryResponse> {
    if (isSQLQuery(query)) {
      return this.querySql(query, queryOptions)
    } else {
      return this.queryNative(query)
    }
  }

  private async queryNative(query: NativeQuery): Promise<NativeQueryResponse> {
    if (!query.queryId) {
      query.queryId = randomUUID()
    }

    const req = fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify(query),
      headers: this.headers,
    }) as NativeQueryResponse
    req.cancel = async () => (await fetch(`${this.endpoint}/${query.queryId}`, { method: 'DELETE', headers: this.headers })).json()

    return req.then(async (res: Response) => {
      if (res.ok) {
        const queryResponse = await res.json()
        if (queryResponse.error) {
          const { error, errorMessage, host } = queryResponse
          throw new Error(`${error} (${errorMessage}) @ ${host}`)
        } else {
          delete queryResponse.error
        }
        return queryResponse
      } else {
        throw new Error(res.statusText)
      }
    })
  }

  private async querySql(query: SQLQuery, queryOptions?: SQLQueryOptions): Promise<SQLQueryResponse> {
    const res = await fetch(this.sqlEndpoint, {
      method: 'POST',
      body: JSON.stringify({ resultFormat: 'object', ...query, ...queryOptions }),
      headers: this.headers,
    })

    if (res.ok) {
      const queryResponse = await res.json() as any
      if (queryResponse.error) {
        const { error, errorMessage, host } = queryResponse
        throw new Error(`${error} (${errorMessage}) @ ${host}`)
      } else {
        delete queryResponse.error
      }

      // add SQL query id to response.
      queryResponse.sqlQueryId = res.headers.get('X-Druid-SQL-Query-Id');

      return queryResponse
    } else {
      throw new Error(res.statusText)
    }
  }

  sql(queryOptions?: SQLQueryOptions): (parts: TemplateStringsArray, ...subSqls: readonly SubSQL[]) => Promise<SQLQueryResponse> {
    return (parts: TemplateStringsArray, ...subSqls: readonly SubSQL[]) => this.querySql(sql(parts, ...subSqls), queryOptions)
  }
}

export default DruidClient

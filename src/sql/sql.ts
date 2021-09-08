import { SQLParameter, isSQLParameter } from './types'

type SQLLiteral = string | number | boolean | null
type InlineSQLResult = [string[], SubSQL[]]
type InlineSQL = (strings: string[], ...subparts: SubSQL[]) => InlineSQLResult
type InlineSQLFunction = (sql: InlineSQL) => SQLLiteral | SQLParameter | InlineSQLResult | undefined
type SubSQL = InlineSQLFunction | SQLLiteral | SQLParameter

function isSQLLiteral(a: any): a is SQLLiteral {
  switch (typeof a) {
    case 'boolean':
    case 'string':
    case 'number':
      return true
    case 'object':
      return a === null
    default:
      return false
  }
}

export function sql(parts: TemplateStringsArray, ...subSqls: readonly SubSQL[]) {
  const sqlTemplate = [parts[0]]
  const parameters: SQLParameter[] = []

  let partsStack = Array.from(parts)
  let subSqlStack = Array.from(subSqls)

  // This function enables sql inside the template
  const inlineSQL = (strings: string[], ...inlineParams: SubSQL[]): [string[], SubSQL[]] => [strings, inlineParams]

  while (subSqlStack.length > 0) {
    const subSql = subSqlStack.shift()
    const last = sqlTemplate.length - 1

    // Check the type of `subSql` and act depending on it.
    if (subSql === undefined) {
      // Ignore undefined values
      sqlTemplate[last] += partsStack.shift()
    } else if (isSQLLiteral(subSql)) {
      // Insert literals into the template
      sqlTemplate[last] += `${JSON.stringify(subSql)} ${partsStack.shift()}`
    } else if (isSQLParameter(subSql)) {
      sqlTemplate.push(partsStack.shift())
      parameters.push(subSql)
    } else if (typeof subSql === 'function') {
      // Execute function and append result to stack
      const result = subSql(inlineSQL)

      if (subSql === undefined) {
        sqlTemplate[last] += partsStack.shift()
      } else if (isSQLLiteral(result)) {
        sqlTemplate[last] += `${JSON.stringify(subSql)} ${partsStack.shift()}`
      } else if (isSQLParameter(result)) {
        sqlTemplate.push(partsStack.shift())
        parameters.push(result)
      } else if (Array.isArray(result)) {
        const [firstStr, ...restStrs] = result[0]
        sqlTemplate[last] += firstStr

        // Add parameters and remaining string to the beginning of the stacks
        partsStack = restStrs.concat(partsStack)
        subSqlStack = result[1].concat(subSqlStack)
      } else {
        // TODO: create custom error
        throw new Error(`Invalid function parameter result: ${result}`)
      }
    } else {
      // Passed something we don't recognize
      throw new Error(`Invalid parameter: ${subSql}`)
    }
  }

  const query = partsStack.join('?')

  return { query, parameters }
}

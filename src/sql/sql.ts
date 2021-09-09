import { SQLParameter, isSQLParameter } from './types'

type SQLLiteral = string | number | boolean | null
type InlineSQLResult = [TemplateStringsArray, readonly SubSQL[]]
type InlineSQL = (strings: TemplateStringsArray, ...subparts: readonly SubSQL[]) => InlineSQLResult
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
  const sqlTemplate = []
  const parameters: SQLParameter[] = []

  let partsStack = Array.from(parts)
  let subSqlStack = Array.from(subSqls)

  // This function enables sql inside the template
  const inlineSQL = (strings: TemplateStringsArray, ...inlineParams: readonly SubSQL[]): InlineSQLResult => [strings, inlineParams]

  sqlTemplate.push(partsStack.shift())
  while (subSqlStack.length > 0) {
    const subSql = subSqlStack.shift()
    const last = sqlTemplate.length - 1

    // Check the type of `subSql` and act depending on it.
    if (subSql === undefined) {
      // Ignore undefined values
      sqlTemplate[last] += partsStack.shift()
    } else if (isSQLLiteral(subSql)) {
      // Insert literals into the template
      sqlTemplate[last] += `${JSON.stringify(subSql)}${partsStack.shift()}`
    } else if (isSQLParameter(subSql)) {
      sqlTemplate.push(partsStack.shift())
      parameters.push(subSql)
    } else if (typeof subSql === 'function') {
      // Execute function and append result to stack
      const result = subSql(inlineSQL)

      if (!result) {
        // Ignore falsy values
        // Allows syntax like sql`${(sql) => falsyVar && sql``}`
        sqlTemplate[last] += partsStack.shift()
      } else if (isSQLLiteral(result)) {
        sqlTemplate[last] += `${JSON.stringify(result)}${partsStack.shift()}`
      } else if (isSQLParameter(result)) {
        sqlTemplate.push(partsStack.shift())
        parameters.push(result)
      } else if (Array.isArray(result)) {
        const [inlineStrings, inlineSubSqls] = result

        // Merge first inline string with last sqlTemplate...
        sqlTemplate[last] += inlineStrings[0]
        if (inlineStrings.length === 1) {
          continue
        } else {
          // ...merge last inlineString with the next sqlTemplate...
          partsStack[0] = inlineStrings[inlineStrings.length - 1] + partsStack[0]
        }

        // Add remaining strings and parameters to the beginning of the stacks,
        // This will flatten the inline sql and we can process it in the next iteration
        partsStack = inlineStrings.slice(1, inlineStrings.length - 1).concat(partsStack)
        subSqlStack = inlineSubSqls.concat(subSqlStack)
      } else {
        // TODO: create custom error
        throw new Error(`Invalid function parameter result: ${result}`)
      }
    } else {
      // Passed something we don't recognize
      throw new Error(`Invalid parameter:, ${JSON.stringify(subSql)}`)
    }
  }

  const query = sqlTemplate.join('?').trim()

  if (parameters.length > 0) {
    return { query, parameters }
  }
  return { query }
}

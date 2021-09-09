import sql, { types } from '.'
import { SQLParameter } from './types'

describe('sql template', () => {
  it('creates a query object with an empty string', () => {
    expect(sql``).toStrictEqual({ query: '' })
  })

  it('creates query with no parameters', () => {
    expect(sql`SELECT * FROM table`).toStrictEqual({ query: 'SELECT * FROM table' })
  })

  it('creates a query with undefined parameters', () => {
    expect(sql`SELECT * ${undefined} FROM ${undefined} table`)
      .toStrictEqual({ query: 'SELECT *  FROM  table' })
  })

  it('creates a query with SQL literals', () => {
    expect(sql`SELECT ${1}, ${true}, ${'hello'}, ${null}, ${false}`)
      .toStrictEqual({ query: 'SELECT 1, true, "hello", null, false' })
  })

  it('creates a query with SQL parameters', () => {
    expect(sql`SELECT ${types.CHAR('a')}, ${types.INTEGER(1)}`)
      .toStrictEqual({ query: 'SELECT ?, ?', parameters: [types.CHAR('a'), types.INTEGER(1)] })
  })

  it('throws if there is an unidentified parameter', () => {
    expect(() => sql`SELECT ${{ not: 'a type' } as any}`).toThrow()
  })

  describe('nested sql', () => {
    it('undefined return values are ignored', () => {
      expect(sql`${() => undefined}`).toStrictEqual({ query: '' })
    })

    it('falsy return values are ignored', () => {
      expect(sql`${() => false}${() => null}${() => ''}`).toStrictEqual({ query: '' })
    })

    it('sql literals are placed in query', () => {
      expect(sql`SELECT ${() => 1}, ${() => 'a'}, ${() => true}`)
        .toStrictEqual({ query: 'SELECT 1, "a", true' })
    })

    it('sql parameters are added', () => {
      expect(sql`SELECT ${() => types.TIMESTAMP('2021-09-08')} FROM ${() => types.VARCHAR('table')}`)
        .toStrictEqual({ query: 'SELECT ? FROM ?', parameters: [types.TIMESTAMP('2021-09-08'), types.VARCHAR('table')] })
    })

    it('inteprets nested sql templates', () => {
      expect(sql`SELECT ${(sql) => sql`${types.VARCHAR('a')}`} FROM table ${(sql) => sql`WHERE ${"x"} = ${1}`}`)
        .toStrictEqual({ query: 'SELECT ? FROM table WHERE "x" = 1', parameters: [types.VARCHAR('a')] })
    })

    it('falsy values inside nested sql templates are interpreted as literals', () => {
      expect(sql`SELECT ${(sql) => sql`${types.VARCHAR('a')}`} FROM table ${(sql) => sql`WHERE ${"x"} = ${1}`} AND y = ${false}`)
        .toStrictEqual({ query: 'SELECT ? FROM table WHERE "x" = 1 AND y = false', parameters: [types.VARCHAR('a')] })
    })

    it('can nest inline sql templates multiple levels', () => {
      expect(sql`SELECT ${(sql) => sql`${() => sql`${types.VARCHAR('a')}`}`} FROM table ${
        (sql) => sql`WHERE ${(sql) => sql`${types.VARCHAR('b')} = ${'a'} AND ${(sql) => sql`${'z'} = ${(sql) => sql`${types.CHAR('z')}`}`}`}`
      }`)
        .toStrictEqual({ query: 'SELECT ? FROM table WHERE ? = "a" AND "z" = ?', parameters: [types.VARCHAR('a'), types.VARCHAR('b'), types.CHAR('z')] })
    })
  })
})

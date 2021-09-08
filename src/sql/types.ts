type SQLString = { type: 'CHAR' | 'VARCHAR' | 'TIMESTAMP' | 'DATE'; value: string; }
type SQLNumber = { type: 'INTEGER' | 'BIGINT' | 'FLOAT' | 'REAL' | 'DECIMAL' | 'DOUBLE' | 'TINYINT' | 'SMALLINT'; value: number; }
type SQLBoolean = { type: 'BOOLEAN', value: boolean; }
type SQLOther = { type: 'OTHER'; value: any; }

export const CHAR = (value: string): SQLString => Object.freeze({ type: 'CHAR', value })
export const VARCHAR = (value: string): SQLString => Object.freeze({ type: 'VARCHAR', value })
export const TIMESTAMP = (value: string): SQLString => Object.freeze({ type: 'TIMESTAMP', value })
export const DATE = (value: string): SQLString => Object.freeze({ type: 'DATE', value })

export const INTEGER = (value: number): SQLNumber => Object.freeze({ type: 'INTEGER', value })
export const BIGINT = (value: number): SQLNumber => Object.freeze({ type: 'BIGINT', value })
export const FLOAT = (value: number): SQLNumber => Object.freeze({ type: 'FLOAT', value })
export const REAL = (value: number): SQLNumber => Object.freeze({ type: 'REAL', value })
export const DECIMAL = (value: number): SQLNumber => Object.freeze({ type: 'DECIMAL', value })
export const DOUBLE = (value: number): SQLNumber => Object.freeze({ type: 'DOUBLE', value })
export const TINYINT = (value: number): SQLNumber => Object.freeze({ type: 'TINYINT', value })
export const SMALLINT = (value: number): SQLNumber => Object.freeze({ type: 'SMALLINT', value })

export const BOOLEAN = (value: boolean): SQLBoolean => Object.freeze({ type: 'BOOLEAN', value })
export const OTHER = (value: any): SQLOther => Object.freeze({ type: 'OTHER', value })

export type SQLParameter = SQLString | SQLNumber | SQLBoolean | SQLOther

export const isSQLParameter =  (a: object): a is SQLParameter => a.hasOwnProperty('type') && a.hasOwnProperty('value')

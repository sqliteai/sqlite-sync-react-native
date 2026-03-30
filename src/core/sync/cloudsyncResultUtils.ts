import type { QueryResult } from '@op-engineering/op-sqlite';

const decodeBytesToString = (bytes: Uint8Array): string => {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }

  return String.fromCharCode(...bytes);
};

export const extractFirstRowValue = (
  result: QueryResult | undefined
): unknown => {
  const firstRow = result?.rows?.[0];
  return firstRow ? Object.values(firstRow)[0] : undefined;
};

export const decodeSQLiteText = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return decodeBytesToString(new Uint8Array(value));
  }

  if (ArrayBuffer.isView(value)) {
    return decodeBytesToString(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    );
  }

  return value == null ? undefined : String(value);
};

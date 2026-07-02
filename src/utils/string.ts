export function required<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("Expected a value but received null or undefined");
  }
  return value;
}

export async function waitUntil({
  predicate,
  attempts = 30,
  intervalMs = 2000,
}: {
  predicate: (attempt: number) => boolean | Promise<boolean>;
  attempts?: number;
  intervalMs?: number;
}): Promise<boolean> {
  for (let i = 1; i <= attempts; i++) {
    if (await predicate(i)) {
      return true;
    }

    await Bun.sleep(intervalMs);
  }

  return false;
}

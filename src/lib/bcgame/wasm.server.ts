type WrUtils = {
  t1: (userAgent: string) => string;
  t2: (random: string, userAgent: string) => string;
};

let loaded: Promise<WrUtils> | null = null;
let chain: Promise<unknown> = Promise.resolve();

export function loadWrUtils(): Promise<WrUtils> {
  if (!loaded) {
    loaded = import("./vendor/wr_utils.mjs").then((mod) => {
      const value = (mod as { default: Promise<WrUtils> | WrUtils }).default;
      return Promise.resolve(value);
    });
  }
  return loaded;
}

/** WASM memory is shared — never overlap t1/t2. */
export function withWrUtils<T>(fn: (wr: WrUtils) => Promise<T> | T): Promise<T> {
  const run = chain.then(async () => {
    const wr = await loadWrUtils();
    return fn(wr);
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

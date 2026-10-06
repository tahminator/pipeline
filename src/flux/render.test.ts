import { expect, test } from "bun:test";

import { objectKey, type RenderedObject, substituteVariables } from "./render";

const object = (
  name: string,
  generated: boolean,
  apiVersion = "v1",
): RenderedObject => ({
  apiVersion,
  kind: "ConfigMap",
  namespace: "app",
  name,
  generated,
  yaml: "",
});

test("generated objects pair across content-hash changes", () => {
  expect(objectKey(object("pre-cfg-sfx-h29d89cmmt", true))).toBe(
    objectKey(object("pre-cfg-sfx-bm76c6cd96", true)),
  );
  expect(objectKey(object("cfg-h29d89cmmt", true))).not.toBe(
    objectKey(object("other-h29d89cmmt", true)),
  );
});

test("hand-written objects keep hash-like name suffixes", () => {
  expect(objectKey(object("cfg-h29d89cmmt", false))).not.toBe(
    objectKey(object("cfg-bm76c6cd96", false)),
  );
});

const vars = { name: "prod", empty: "" };

test("applies values, defaults and Flux's empty-string semantics", () => {
  const { output } = substituteVariables(
    [
      "a: ${name}",
      "b: ${missing:-fallback}",
      "c: ${empty:-fallback}",
      "d: ${empty-fallback}",
      "e: ${missing}",
    ].join("\n"),
    vars,
    { keepUnresolved: false },
  );

  expect(output).toBe(
    ["a: prod", "b: fallback", "c: fallback", "d: ", "e: "].join("\n"),
  );
});

test("$${VAR} escapes to a literal ${VAR}", () => {
  const { output } = substituteVariables("a: $${name}", vars, {
    keepUnresolved: false,
  });
  expect(output).toBe("a: ${name}");
});

test("keeps and reports unknown variables when values come from the cluster", () => {
  const { output, unresolved } = substituteVariables(
    "a: ${zeta}\nb: ${alpha}\nc: ${name}",
    vars,
    { keepUnresolved: true },
  );
  expect(output).toBe("a: ${zeta}\nb: ${alpha}\nc: prod");
  expect(unresolved).toEqual(["alpha", "zeta"]);
});

test("skips only documents annotated with substitute: disabled", () => {
  const input = [
    "kind: A",
    "metadata:",
    "  annotations:",
    "    kustomize.toolkit.fluxcd.io/substitute: disabled",
    "v: ${name}",
    "---",
    "kind: B",
    "v: ${name}",
  ].join("\n");

  const { output } = substituteVariables(input, vars, {
    keepUnresolved: false,
  });
  expect(output.split("---")[0]).toContain("v: ${name}");
  expect(output.split("---")[1]).toContain("v: prod");
});

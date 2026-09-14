import path from "node:path";

type Module = { files: string[]; children: Map<string, Module> };

/** Prost filenames encode proto packages; Tonic belongs in the same module. */
export function createRustLibrary(generatedFiles: string[]): string {
  const root: Module = { files: [], children: new Map() };
  for (const file of [...generatedFiles].sort()) {
    const packageName = path.posix
      .basename(file)
      .replace(/(?:\.tonic)?\.rs$/, "");
    let node = root;
    for (const segment of packageName === "_" ? [] : packageName.split(".")) {
      if (
        !/^(?:r#)?[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment) ||
        ["self", "Self", "super", "crate"].includes(segment)
      ) {
        throw new Error(
          `Cannot represent Rust package module ${segment} from ${file}.`,
        );
      }
      const name = segment.startsWith("r#") ? segment : `r#${segment}`;
      let child = node.children.get(name);
      if (!child) {
        child = { files: [], children: new Map() };
        node.children.set(name, child);
      }
      node = child;
    }
    node.files.push(file);
  }

  function render(node: Module, indent = ""): string {
    const includes = node.files
      .map(
        (file) =>
          `${indent}include!(concat!(env!("CARGO_MANIFEST_DIR"), ${JSON.stringify(`/${file}`)}));\n`,
      )
      .join("");
    const children = [...node.children]
      .map(
        ([name, child]) =>
          `${indent}pub mod ${name} {\n${render(child, `${indent}    `)}${indent}}\n`,
      )
      .join("");
    return includes + children;
  }
  return render(root);
}

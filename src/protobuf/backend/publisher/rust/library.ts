import path from "node:path";

type Module = { files: string[]; children: Map<string, Module> };

/**
 * Create the Cargo library entry file for generated Rust code.
 *
 * ```text
 * Buf writes one Rust file for each proto package.
 * Example:
 *   example.v1.rs
 *   example.v1.tonic.rs
 *
 * Cargo does not load these files by itself.
 * A crate must have src/lib.rs.
 * This function writes the content for that file.
 *
 * The module path must match the proto package.
 * example.v1 becomes example::v1.
 * The Prost messages and Tonic services go in the same module.
 * ```
 */
export function createRustLibrary(generatedFiles: string[]): string {
  const root: Module = { files: [], children: new Map() };
  for (const file of [...generatedFiles].sort()) {
    const packageName = path.posix
      .basename(file)
      .replace(/(?:\.tonic)?\.rs$/, "");
    let node = root;
    for (const segment of packageName === "_" ? [] : packageName.split(".")) {
      /*
       * Rust module names must be valid identifiers.
       * We fail here instead of publishing a crate that cannot compile.
       */
      if (
        !/^(?:r#)?[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment) ||
        ["self", "Self", "super", "crate"].includes(segment)
      ) {
        throw new Error(
          `Cannot represent Rust package module ${segment} from ${file}.`,
        );
      }
      /*
       * Use a raw identifier for each module name.
       * This makes names such as type or match safe in Rust.
       */
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
    /*
     * Include files from the crate root.
     * The generated files stay outside src.
     * CARGO_MANIFEST_DIR gives Cargo the crate root path.
     */
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

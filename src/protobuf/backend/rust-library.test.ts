import { expect, test } from "bun:test";

import { createRustLibrary } from "./rust-library";

test("nests packages and includes Tonic beside its messages", () => {
  expect(
    createRustLibrary([
      "example/v1/example.v1.rs",
      "example/v1/example.v1.tonic.rs",
      "common/v1/common.v1.rs",
    ]),
  ).toBe(`pub mod r#common {
    pub mod r#v1 {
        include!(concat!(env!("CARGO_MANIFEST_DIR"), "/common/v1/common.v1.rs"));
    }
}
pub mod r#example {
    pub mod r#v1 {
        include!(concat!(env!("CARGO_MANIFEST_DIR"), "/example/v1/example.v1.rs"));
        include!(concat!(env!("CARGO_MANIFEST_DIR"), "/example/v1/example.v1.tonic.rs"));
    }
}
`);
});

test("supports package-less protos and Rust keyword package names", () => {
  const library = createRustLibrary(["_.rs", "type/type.rs"]);
  expect(library).toContain('"/_.rs"');
  expect(library).toContain("pub mod r#type");
});

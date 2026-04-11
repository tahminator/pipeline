import type { OpMap, OpType, UpResult } from "@pulumi/pulumi/automation";

import {
  AzurePulumiClientStrategy,
  type ChargedPreviewOutput,
  type IPulumiClientStrategy,
} from "./strategy";
import { type PulumiClientCreateArgs, PulumiClientStrategy } from "./types";

export class PulumiClient {
  static opTypeMetadata: Record<OpType, { emoji: string; label: string }> = {
    create: { emoji: "🟢", label: "Create" },
    update: { emoji: "🟡", label: "Update" },
    replace: { emoji: "🔵", label: "Replace" },
    delete: { emoji: "🔴", label: "Delete" },
    same: { emoji: "⚪", label: "Unchanged" },
    refresh: { emoji: "🔄", label: "Refresh" },
    import: { emoji: "📥", label: "Import" },
    read: { emoji: "🔍", label: "Read" },
    discard: { emoji: "💨", label: "Discard" },
    "create-replacement": { emoji: "✳️", label: "Create Replacement" },
    "delete-replaced": { emoji: "🗑️", label: "Delete Replaced" },
    "read-replacement": { emoji: "📖", label: "Read Replacement" },
    "import-replacement": { emoji: "📥", label: "Import Replacement" },
    "discard-replaced": { emoji: "💨", label: "Discard Replaced" },
    "remove-pending-replace": {
      emoji: "🧹",
      label: "Remove Pending Replace",
    },
  };
  private constructor(private readonly strategy: IPulumiClientStrategy) {}

  static async create(args: PulumiClientCreateArgs): Promise<PulumiClient> {
    switch (args.strategy) {
      case PulumiClientStrategy.AZURE:
        return new this(await AzurePulumiClientStrategy.create(args));
    }
  }

  async up(): Promise<UpResult> {
    return this.strategy.up();
  }

  async preview(): Promise<ChargedPreviewOutput> {
    return this.strategy.preview();
  }

  static parseChangeSumaryToPrettyTable(changeSummary: OpMap): string {
    const entries = Object.entries(changeSummary).filter(
      ([_, count]) => count > 0,
    );

    if (entries.length === 0) {
      return "✅ **No infrastructure changes detected.** Everything is in sync.";
    }

    // prioritize important ops
    (() => {
      const priority = [
        "delete",
        "replace",
        "delete-replaced",
        "create",
        "update",
      ];
      entries.sort((a, b) => {
        const indexA = priority.indexOf(a[0]);
        const indexB = priority.indexOf(b[0]);
        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
      });
    })();

    let table = "| | Operation | Count |\n";
    table += "| :--- | :--- | :--- |\n";

    for (const [op, count] of entries) {
      const meta = this.opTypeMetadata[op as OpType];
      table += `| ${meta.emoji} | **${meta.label}** | \`${count}\` |\n`;
    }

    return table;
  }
}

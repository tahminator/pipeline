# Slash commands

Run your repository's workflows from PR comments such as `/merge` or `/ai`. See the [main README](../../README.md#slash-commands-action) for a complete workflow with checkout and setup.

## Choose a command source

Run `actions/setup` first to provide Bun, `yargs`, and your loader's dependencies. This action installs nothing. Replace `<published-commit-sha>` with a reviewed pipeline commit.

### Hardcoded commands

```yaml
- uses: tahminator/pipeline/actions/commands@<published-commit-sha>
  with:
    APP_ID: ${{ secrets._GITHUB_APP_APP_ID }}
    PRIVATE_KEY: ${{ secrets._GITHUB_APP_PEM_CONTENT }}
    COMMANDS: |
      merge
      ai
      copy
```

### Commands from a Bun script

Use `DYNAMIC_COMMANDS_BUN_SCRIPT` instead of `COMMANDS`:

```yaml
- uses: tahminator/pipeline/actions/commands@<published-commit-sha>
  with:
    APP_ID: ${{ secrets._GITHUB_APP_APP_ID }}
    PRIVATE_KEY: ${{ secrets._GITHUB_APP_PEM_CONTENT }}
    DYNAMIC_COMMANDS_BUN_SCRIPT: .github/scripts/src/load-slash-commands/index.ts
```

In that file, print the command names:

```ts
const commands = ["merge", "ai", "copy"];
console.log(commands.join("\n"));
```

The script runs from the repository root with no arguments. Print only command names to stdout, separated by newlines or commas. Use `console.error` for logs. Empty or invalid output, or a nonzero exit, fails the action.

## Inputs

| Input                         | Use                                               |
| ----------------------------- | ------------------------------------------------- |
| `APP_ID`                      | Required GitHub App ID.                           |
| `PRIVATE_KEY`                 | Required GitHub App private key.                  |
| `COMMANDS`                    | Hardcoded names, separated by commas or newlines. |
| `DYNAMIC_COMMANDS_BUN_SCRIPT` | Repository-relative path to a Bun loader.         |

Set exactly one of `COMMANDS` or `DYNAMIC_COMMANDS_BUN_SCRIPT`.

## Command workflows

For `/merge`, create `merge-command.yml` (or `.yaml`) with a `workflow_dispatch` trigger accepting `repository`, `comment-id`, `prId`, and `author` inputs. The workflow must exist on the default branch; dispatch runs its PR-branch version so you can test changes before merging. Each repository implements its own handlers.

The main README includes a complete [end-to-end `/hello` example](../../README.md#end-to-end-example) with both the dispatcher and handler workflows.

The GitHub App needs repository **Actions: write**, **Issues: write**, **Pull requests: read**, and metadata access. Handler permissions depend on what the command does.

## Access control

Only new slash comments on open, same-repository PRs are accepted. The commenter must have **write, maintain, or admin** permission. These checks cannot be disabled and happen before the loader's PR-head checkout and execution.

Keep checkout/setup before this action on trusted default-branch code, as shown in the main README. This action cannot protect PR code that earlier workflow steps have already executed.

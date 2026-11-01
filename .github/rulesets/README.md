# Default branch protection

Arco uses `main` as its default branch. These two rulesets follow the default branch if it is renamed. They adapt the owner-review and required-check pattern from [EditTrace](https://github.com/rajmayank/EditTrace/tree/main/.github/rulesets).

| Ruleset | Enforcement |
| --- | --- |
| [main-checks.json](main-checks.json) | Require the `check` job from GitHub Actions against an up-to-date branch. Block deletion, force pushes, and merge commits. Nobody can bypass this ruleset. |
| [main-reviews.json](main-reviews.json) | Require a pull request, one code-owner approval, fresh approval after new commits, and resolved review conversations. Allow squash merges only. |

[CODEOWNERS](../CODEOWNERS) assigns every path to `@rajmayank`. Only `@rajmayank` can bypass review requirements, and only through a pull request. This permits the owner to merge their own PR without self-approval. It also permits the owner to bypass review requirements on another PR. It does not permit direct pushes or skipping CI.

## Apply or update

The JSON files document the intended settings. Committing them does not activate GitHub rules. An administrator must apply them through [repository ruleset settings](https://github.com/rajmayank/arco-music/settings/rules) or the API.

Check for existing rulesets before creating anything:

```sh
gh api repos/rajmayank/arco-music/rulesets
```

For first-time setup only:

```sh
gh api --method POST repos/rajmayank/arco-music/rulesets --input .github/rulesets/main-checks.json
gh api --method POST repos/rajmayank/arco-music/rulesets --input .github/rulesets/main-reviews.json
```

For an existing rule, use `PUT repos/rajmayank/arco-music/rulesets/RULESET_ID` with the corresponding file. Verify the active settings afterwards:

```sh
gh api repos/rajmayank/arco-music/rules/branches/main
```

Keep the required `check` context aligned with the job in [pages.yml](../workflows/pages.yml). Deployment is excluded from required PR checks because it runs after merging. The `github-pages` environment permits deployments only from the `main` branch; update the workflow and environment policy if the default branch changes.

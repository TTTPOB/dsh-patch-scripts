# dsh-patch-scripts

个人使用的 DSH runtime 补丁集合。5 个补丁统一修改当前 `dsh` 对应的 **installation**，不再修改某个 profile 的副本。补丁只支持清单中声明的精确官方版本；`test` 在副本中运行，`apply` 才修改 installation。

## 支持版本

- DSH：`0.1.5-rc.2`
- `@deepseek-ai/dsh-subagent`：`0.1.5-rc.2`
- `@deepseek-ai/dsh-llm-pi-ai`：`0.1.5-rc.2`
- `@deepseek-ai/dsh-mcp-client`：`0.1.5-rc.2`
- `@earendil-works/pi-ai`：`0.85.1`
- MCP support packages：`@modelcontextprotocol/client@2.0.0`、`@modelcontextprotocol/core@2.0.0`

`deployments/package-set.mjs` 明确区分：

- `installationTargets`：实际被补丁修改的 installation package；
- `supportDependencies`：必须由 installation 内的 MCP client 自身解析到的精确依赖；
- `verificationSharedDependencies`：只用于确认官方 DSH dependency closure 的版本。

## 从旧版迁移（只需一次）

旧版 `personal-web-0.1.5-rc.2` 已停用，避免继续静默修改 profile-local 副本。

1. 先把两个 MCP support package 精确安装到当前 DSH installation：

   ```sh
   curl -fsSL https://raw.githubusercontent.com/TTTPOB/dsh-patch-scripts/0.1.5-rc.2-2/bootstrap.sh \
     | bash -s -- prepare-support installation-0.1.5-rc.2
   ```

2. 如果 `web` profile 曾直装旧目标包，通过 DSH 官方 reconciliation 删除它们：

   ```sh
   dsh plugin --profile web remove \
     @deepseek-ai/dsh-llm-pi-ai \
     @deepseek-ai/dsh-mcp-client \
     @earendil-works/pi-ai \
     @modelcontextprotocol/client \
     @modelcontextprotocol/core
   ```

   这条命令只移除以上旧 shadow package；不要手改 profile 的 `package.json`、lockfile 或 `node_modules`。其他个人 plugin 保持不变。`doctor` 如果仍发现 shadow，会给出对应的 reconciliation 命令并停止。

3. 检查、staged test，然后应用：

   ```sh
   curl -fsSL https://raw.githubusercontent.com/TTTPOB/dsh-patch-scripts/0.1.5-rc.2-2/bootstrap.sh \
     | bash -s -- doctor installation-0.1.5-rc.2

   curl -fsSL https://raw.githubusercontent.com/TTTPOB/dsh-patch-scripts/0.1.5-rc.2-2/bootstrap.sh \
     | bash -s -- test installation-0.1.5-rc.2

   curl -fsSL https://raw.githubusercontent.com/TTTPOB/dsh-patch-scripts/0.1.5-rc.2-2/bootstrap.sh \
     | bash -s -- apply installation-0.1.5-rc.2
   ```

`prepare-support` 只在当前 DSH installation project 运行一次精确的 `pnpm add --save-exact`。`apply` 会再次执行 preflight 和 staged test；脚本不会重启 Host，也不会修改 profile。

## Installation 定位与检查

默认从 `command -v dsh` 的 pnpm shim `cmd-shim-target` 找到 installation project，再从真实 `@deepseek-ai/dsh` package 解析全部目标。不会把 `pnpm root -g` 误当成 `node_modules`。

需要检查另一个 installation fixture 时可显式指定 project root：

```sh
DSH_PATCH_INSTALLATION_ROOT=/path/to/project \
node src/cli.mjs doctor --deployment installation-0.1.5-rc.2
```

`doctor` 会检查：

- 当前 `dsh --version` 和实际 installation project；
- installation target、support dependency 和共享验证依赖的 package name、精确版本与官方 lock entry；
- `@deepseek-ai/dsh-llm-pi-ai` 自身解析到的 `pi-ai` 是否就是被补丁修改的副本；
- `@deepseek-ai/dsh-mcp-client` 自身是否解析到精确的 MCP support package；
- web profile 是否仍有旧 shadow package；
- 补丁状态是否为 `ready` 或 `applied`。

任何版本错配、非官方来源、错误 dependency identity、shadow、`partial` 或 `drifted` 都会阻止测试和应用。

## 本地开发

```sh
corepack pnpm@11.24.0 install --frozen-lockfile
corepack pnpm@11.24.0 test
corepack pnpm@11.24.0 test:official
corepack pnpm@11.24.0 check
```

官方 baseline 是独立测试 deployment，不会写真实 installation：

```sh
node src/cli.mjs doctor --deployment official-0.1.5-rc.2
node src/cli.mjs test --deployment official-0.1.5-rc.2 --keep-work
```

保留的副本位于 `.patch-work/cases/`；源 package 不会被修改。Workspace 不设置项目内 pnpm store/cache。

## 备份与恢复

成功应用前，原文件保存到：

```text
.patch-work/backups/<timestamp>-<deployment>/
```

恢复：

```sh
node src/cli.mjs restore \
  --backup .patch-work/backups/<timestamp>-<deployment>
```

transaction 先写新 inode 再 rename，避免修改 pnpm store 的 hardlink inode；多文件提交失败时会恢复本次已替换的文件。重复运行 `doctor`、`test` 和 `apply` 能识别已经应用的补丁。

## 重新安装之后

pnpm 重装或更新 DSH 后，依次重新运行 `prepare-support`、`doctor`、`test`、`apply`。如果版本变化，停止应用并先为新版本增加独立 deployment 和官方 baseline。

Host package 修改后必须从外部终端重启 DSH，并创建新会话验证。脚本自身绝不会停止或重启当前 Host。

## Bootstrap 开发覆盖

```sh
DSH_PATCH_SOURCE_DIR="$PWD" ./bootstrap.sh test official-0.1.5-rc.2
```

也可覆盖下载来源：

```sh
DSH_PATCH_REPO=TTTPOB/dsh-patch-scripts \
DSH_PATCH_REF=0.1.5-rc.2-2 \
DSH_PATCH_BASE_URL=https://github.com \
./bootstrap.sh doctor installation-0.1.5-rc.2
```

`bootstrap.sh` 不使用 `sudo`，不全局安装 pnpm，不修改 pnpm store/cache 设置。

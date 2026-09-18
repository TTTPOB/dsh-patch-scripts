# dsh-patch-scripts

个人使用的 DSH runtime 补丁集合。补丁只支持清单中声明的精确官方版本；`test` 在副本中运行，`apply` 才修改目标安装。

## 支持版本

- DSH：`0.1.5-rc.2`
- `@deepseek-ai/dsh-subagent`：`0.1.5-rc.2`
- `@deepseek-ai/dsh-llm-pi-ai`：`0.1.5-rc.2`
- `@deepseek-ai/dsh-mcp-client`：`0.1.5-rc.2`
- `@earendil-works/pi-ai`：`0.85.1`
- MCP SDK v2 support packages：`2.0.0`

版本、解析根和补丁顺序以 `deployments/*.mjs` 为唯一真源。

## 最快用法

固定 tag 的安装检查：

```sh
curl -fsSL https://raw.githubusercontent.com/TTTPOB/dsh-patch-scripts/v0.1.0/bootstrap.sh \
  | bash -s -- doctor personal-web-0.1.5-rc.2
```

在临时副本中测试当前安装，不修改 `~/.dsh`：

```sh
curl -fsSL https://raw.githubusercontent.com/TTTPOB/dsh-patch-scripts/v0.1.0/bootstrap.sh \
  | bash -s -- test personal-web-0.1.5-rc.2
```

测试通过后应用：

```sh
curl -fsSL https://raw.githubusercontent.com/TTTPOB/dsh-patch-scripts/v0.1.0/bootstrap.sh \
  | bash -s -- apply personal-web-0.1.5-rc.2
```

`apply` 会再次执行 preflight 和 staged test。它不会安装或升级 DSH 包，也不会重启 Host。

## 准备自用 profile

先通过 DSH 官方 reconciliation 安装精确官方包：

```sh
dsh plugin --profile web add \
  @deepseek-ai/dsh-llm-pi-ai@0.1.5-rc.2 \
  @deepseek-ai/dsh-mcp-client@0.1.5-rc.2 \
  @earendil-works/pi-ai@0.85.1 \
  @modelcontextprotocol/client@2.0.0 \
  @modelcontextprotocol/core@2.0.0
```

`doctor` 会检查：

- 当前 `dsh --version`；
- 当前补丁集依赖的完整 DSH package 集合；
- profile/shared 的实际模块解析路径；
- package name 和 exact version；
- profile manifest 与对应 lockfile importer；
- registry 来源；
- 补丁后的 import dependencies；
- `ready`、`applied`、`partial` 或 `drifted` 状态。

任何版本错配、错误解析根、非官方 URL、partial 或 drifted 状态都会阻止测试和应用。

## 本地开发

```sh
corepack pnpm@11.24.0 install --frozen-lockfile
corepack pnpm@11.24.0 test
corepack pnpm@11.24.0 test:official
corepack pnpm@11.24.0 check
```

检查官方 baseline：

```sh
node src/cli.mjs doctor --deployment official-0.1.5-rc.2
```

保留 staged 工作副本用于检查：

```sh
node src/cli.mjs test \
  --deployment official-0.1.5-rc.2 \
  --keep-work
```

副本位于 `.patch-work/cases/`。官方 baseline 的 `node_modules` 不会被修改。

## 添加补丁

1. 在 `patches/` 新建 ESM spec。
2. 声明 package、相对文件、精确 `before`/`after` 和必要 marker。
3. 在 `patches/index.mjs` 注册。
4. 在 deployment 的 `patches` 中确定顺序。
5. 为状态、staged apply 或 transaction 增加聚焦测试。
6. 运行 `pnpm check`。

框架只做精确替换，不模糊匹配未知版本。

## pnpm 存储

Workspace 不设置 `store-dir` 或 `cache-dir`，也不创建项目内 store/cache。pnpm 使用默认用户级 content-addressable store；本项目只保留自己的 `node_modules/.pnpm` virtual store 和链接。

可用以下命令确认实际 store：

```sh
corepack pnpm@11.24.0 store path
```

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

多文件提交失败时，框架自动恢复本次已替换的文件。

## 重新安装之后

pnpm 重装或更新 package 后，先重新运行：

```sh
node src/cli.mjs doctor --deployment personal-web-0.1.5-rc.2
node src/cli.mjs test --deployment personal-web-0.1.5-rc.2
node src/cli.mjs apply --deployment personal-web-0.1.5-rc.2
```

如果版本变化，停止应用并先为新版本增加独立 deployment 和官方 baseline。

## 重启

Host package 修改后必须从外部终端重启 DSH，并创建新会话验证。脚本不会停止或重启当前 DSH Host。

## Bootstrap 开发覆盖

首次发布前可以直接使用本地源码：

```sh
DSH_PATCH_SOURCE_DIR="$PWD" ./bootstrap.sh test official-0.1.5-rc.2
```

也可以覆盖下载来源：

```sh
DSH_PATCH_REPO=TTTPOB/dsh-patch-scripts \
DSH_PATCH_REF=v0.1.0 \
DSH_PATCH_BASE_URL=https://github.com \
./bootstrap.sh doctor personal-web-0.1.5-rc.2
```

`bootstrap.sh` 不使用 `sudo`，不全局安装 pnpm，不修改 pnpm store/cache 设置。

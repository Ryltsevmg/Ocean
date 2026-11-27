# `@ocean/ocean`

[English](README.md) | 中文

`ocean` 是唯一受支持的 Node 应用启动器；profile 由多个插件组合包 patch 层按顺序叠加而成，其上再应用用户自己的覆盖配置。SDK 与 ACP（Agent Client Protocol）都是 profile，而不是独立的公开可执行命令。Python 运行时 wheel 包中也包含同一个命令；SDK 默认使用 `sdk`，极简示例选择 `sdk-minimal`。[`src/args.ts`](src/args.ts) 负责命令语法，[`src/bin.ts`](src/bin.ts) 只加载选中的运行器。无效命令、来自其他模式的选项，以及致命的配置或启动错误都会以非零状态退出。

## 入口模式

| 命令 | 用途 |
|---|---|
| `ocean <name>` / `ocean --profile <name>` | 启动位于 `$OCEAN_HOME/profiles/<name>` 的指定 profile。 |
| `ocean --profile <name> --from-default-profile <template>` | 用随附模板的全新副本替换自定义 profile，然后启动它。 |
| `ocean --profile acp` | 通过 ACP stdio 为自动化客户端提供服务，直至断开连接。 |
| `ocean --profile headless "job"` | 运行一个全新的持久化会话，打印最终答案并退出。 |
| `ocean --profile sdk` | 通过 JSON-RPC stdio 为 SDK 客户端提供服务，直至关闭或断开连接。 |
| `ocean --profile sdk-minimal` | 以独立极简 agent（智能体）配置树为 SDK 客户端提供服务。 |
| `ocean web` | 启动 Web profile。 |
| `ocean serve` | 为远程设备运行 Host。 |
| `ocean connect` | 向远程 Host 发送命令。 |
| `ocean remote-device` | 在本地初始化设备凭据，或通过运行中 Host 的 Unix 套接字管理凭据。 |
| `ocean plugin --profile <name> <pnpm args>` | 通过在 profile 目录中转发给 pnpm 来管理该 profile 的插件。 |

运行命令时所在的目录将作为默认 workspace 根目录。`web`、`serve`、`connect`、`remote-device`、`headless`、`sdk`、`sdk-minimal` 和 `acp` profile 在首次使用时会从随附模板自动初始化。使用 `--from-default-profile` 可以基于这些模板之一，在非内置名称处创建或重置其他 profile；通过 `ocean plugin` 则可以初始化一个以 base 为基础的 profile。`desktop` 名称保留给 Electron 持有的 profile，因此 CLI（命令行界面）会拒绝针对它的启动和配置 dump 请求。npm CLI 也会拒绝其插件管理请求；[Desktop 内置命令](../desktop/README.zh.md#bundled-command-runtime)可以使用该安装的运行时管理已初始化的 Desktop profile。

`serve` profile 运行 Web Host，不打开浏览器，也不监视配置。就绪消息输出不含凭据的 URL。非环回监听地址必须使用 TLS。可在浏览器、Desktop 的**连接远程 Host**对话框或通过 `ocean connect` 使用设备令牌登录。此 profile 拒绝旧版所有者凭据。

使用原生 TLS 时，通过 `--tls-cert` 传入 PEM 证书链，通过 `--tls-key` 传入对应的密钥。当 HTTPS 反向代理终止 TLS 时，将 Ocean 绑定到环回地址，用 `--public-url` 指定外部 HTTPS 根地址，用 `--trusted-host` 指定其主机名。配置代理以保留公共 Host 标头、转发 WebSocket 升级请求，并在将请求转发给 Ocean 前移除外部挂载路径前缀。客户端使用包含挂载路径的公共 URL。对于 tailnet 中的机器，`ocean serve --tailscale-serve` 同时取代证书和代理：监听器保持在回环地址，并通过 `tailscale serve` 发布 `https://<node>.<tailnet>.ts.net/`，因此无需 TLS 文件或端口转发。服务、容器和恢复步骤见[部署远程 Host](../../docs/cookbook/deploying-remote-host.zh.md)。

在 Windows、macOS 和 Linux 上，以 Host 的服务账户并使用相同的 `OCEAN_HOME` 运行 `ocean remote-device --bootstrap create <label>`，无需启动监听器即可创建设备。使用 `ocean remote-device --bootstrap list` 查看设备元数据，不输出令牌。运行中的 Host 通过文件监听器读取凭据更新；配置为 `watch: false` 的凭据提供者需要重新加载。Bootstrap 支持 create、list 和 password；pair、rotate 和 revoke 需要使用运行中的 Unix 管理套接字。`--bootstrap` 和 `--socket` 必须且只能选择一个。`--timeout` 仅限制套接字操作的等待时间。

在 Unix 上，使用 `ocean serve --device-admin-socket /absolute/private-dir/admin.sock` 启动 Host。目录必须已存在，且只能由服务器用户访问。运行 `ocean remote-device --socket /absolute/private-dir/admin.sock create <label>`，或使用 `list`、`rotate <id>` 和 `revoke <id>`。创建和轮换会将持有者令牌输出到 stdout。请直接将它交给目标客户端，避免写入日志。`create` 和 `pair` 接受可重复的 `--scope <name>`，把设备收窄到指定权限：`sessions:read`、`sessions:write`、`files:read`、`files:write`、`terminal:operate` 和 `settings:manage`。不指定 `--scope` 时设备持有全部权限，与之前一致。设备保留创建时的权限，因此扩大权限意味着创建另一个设备并撤销旧的。

要在不输入令牌的情况下添加设备，请运行 `ocean remote-device --socket /absolute/private-dir/admin.sock pair <label> --url https://host.example/`。当 Host 知道自己的公共 HTTPS 地址时（例如使用 `--tailscale-serve` 或 `--public-url`），`--url` 可省略。命令输出包含三个字段的 JSON：`link`，供 Desktop 使用的一次性 `ocean://pair` 链接；`web`，片段中带有授权的 Host 地址 `https://<host>/<mount>#pair=<grant>`，供浏览器或 `ocean connect` 使用；以及 `expiresAt`。标签和权限已在 Host 上分配给该设备，因此 `web` 不携带它们。两个链接花费同一个一次性授权，先使用的那个生效。链接在十分钟后过期，除非用 `--ttl <seconds>`（30 至 3600）指定。在设备的浏览器中打开 `web`，把任一链接传给 `ocean connect --pair`，或粘贴到 Desktop 的**连接远程 Host**对话框的地址栏中，并确认地址。`--qr` 还会把 `web` 的 QR 码打印到 stderr，在浅色和深色终端中均可读，stdout 仍是 JSON。链接在使用或过期之前应视同密码。`pair` 需要运行中 Host 的管理 socket，不能与 `--bootstrap` 一起使用。

要让设备无需为每台单独生成链接就能配对，请设置一个配对密码：`ocean remote-device --socket /absolute/private-dir/admin.sock password --password-stdin` 从管道或重定向输入读取新密码，`--password-env <NAME>` 从环境变量读取，`--clear` 删除密码；三者必须且只能提供一个。密码去除首尾空白后必须为 8 至 256 个字符，Host 只保存加盐的校验值。命令输出 `Pairing password set.` 或 `Pairing password cleared.`，绝不输出密码，因此在没有套接字的地方同样可用：`ocean remote-device --bootstrap password --password-env OCEAN_PAIRING_PASSWORD`。设备通过 `@ocean/ocean-client-connection/device` 的 `DeviceClient.pairWithPassword` 提交密码来配对，详见[连接 README](../../packages/client/connection/README.zh.md#browser-authentication-and-request-trust)。以这种方式配对的每台设备都持有全部权限；需要更少权限的设备请使用带 `--scope` 的 `create` 或 `pair`。

运行 `ocean connect --url https://host.example --token-env OCEAN_DEVICE_TOKEN list` 可用 JSON 输出远程 Session 摘要。启动前请设置指定的环境变量，或配合管道或输入重定向使用 `--token-stdin`。不用这些选项时，`--pair <link>` 接受 `ocean remote-device pair` 输出的任一形式的配对链接：它用授权换取设备令牌，用该令牌登录，然后照常执行命令。它替代 `--url`、`--token-env` 和 `--token-stdin`，不能与之组合。授权已被消耗，因此客户端会把新设备的 ID 和令牌在 stderr 打印一次，以便之后用于 `--token-env`。无效、已过期或已使用的链接，以及不支持配对的 Host，各有自己的失败消息。客户端正常验证 TLS 证书，并在命令执行期间将登录凭据保存在内存中。

同一客户端支持 `create [--cwd <host-path>]`、`history <session-id>`、`prompt <session-id> <text> [--steer]`、`state <session-id>`、`wait <session-id>` 和 `cancel <session-id>`。发送提示前会把请求 ID 写入 stderr，结果未知时的诊断也会显示该 ID。仅在重试同一个提示时使用 `--request-id <uuid>`。其他修改状态的命令结果未知时，请先检查会话再重试。

使用 `approvals <session-id>` 列出待处理的工具审批，并使用 `approve <session-id> <approval-id> <allow-or-deny>` 作答。响应中的 `accepted: false` 表示该会话已无对应的待处理请求。Host 设置了审批期限时，待处理项会包含以 Unix 毫秒表示的 `expiresAt`。

使用 `questions <session-id>` 列出当前问题，并用 `answer-question <session-id> <question-request-id> <answer-json>` 提交结构化答复。例如，`{"answers":[{"id":"q1","selected":["Remote"]}]}` 选择一个已提供的选项。自由文本答复使用空的 `selected` 数组和 `custom` 字符串。前台计时结束后，使用 `questions <session-id> --continued` 查找问题的 `callId`。将该 ID 传给带有 `--continued` 的 `answer-question`。

使用 `files <session-id> [path]` 列出 Host 的工作区目录。使用 `read <session-id> <path> [--offset <line>] [--limit <lines>]` 读取文本页。相对路径以 Host 上的 Session 工作区为基准。

使用 `upload <session-id> <local-path>` 流式上传本地文件并获取 JSON 附件回执。向同一会话发送 `prompt <session-id> <text> --file <receipt-id>` 时传入返回的 `receiptId`。

使用 `terminals <session-id>` 列出 Host 终端，使用 `terminal-create <session-id> [--id <id>]` 启动 Host shell，并使用 `terminal-close <session-id> <terminal-id>` 结束它。创建命令会在发送请求前打印终端 ID，以便丢失响应时复用相同标识。

使用 `terminal-watch <session-id> <terminal-id>` 以 JSON Lines 格式读取保留终端的屏幕和后续帧。传输失败后，客户端检查现有登录并按退避策略重试。下一张快照替换此前的屏幕。Host 或启动 epoch 变更时，监视结束。

使用 `terminal-write <session-id> <terminal-id> <text>` 发送一次输入并等待 Host 确认。需要 shell 执行该行时，请在文本中包含换行符。如果提交后连接断开，请先检查终端，再决定是否重新发送。

使用 `follow <session-id>` 以 JSON Lines 格式读取历史快照和后续事件。连接中断后，新的有界快照替换此前的基线。如果 Host 在恢复期间拒绝当前登录，命令会退出并提示使用有效的设备令牌。使用 `history <session-id> --before-seq <seq>` 请求当前页首个事件之前的历史。

## 应用参数

启动器只解析自身的 flag，并将其后的所有内容交给已启动的 profile；注入该 profile 的任意应用插件都可以解析这份共享的不可变快照（[`ocean-cmdline`](../../packages/boot/cmdline/README.zh.md)）。启动器无法识别的第一个 token 标志着应用参数的开始：

```sh
ocean --profile web --port 8080       # --port belongs to the web app
ocean --profile tui --resume <id>     # example, assuming the tui profile is installed; --resume belongs to the terminal app
ocean --profile headless "run the tests"
ocean --profile web --help            # the web app's flags, not the launcher's
ocean --help                          # the launcher's own help
```

<a id="profiles"></a>
## Profile

profile 目录包含一个 `package.json`，其中记录树外插件依赖，以及 profile manifest（元数据清单）`ocean.profile`、其中按顺序排列的 `bundles` 列表；还包含一个 `cordis.patch.yml`，其中保存用户自己的 patch 层。在 YAML 中启用的 `ocean-hmr` 监视 profile manifest、profile 与 home 级 patch 文件，再通过统一串行重载重新组合所有层。未启用 HMR 时，更改在重启后生效。监听器注册期间发生的编辑与后续编辑使用相同的非致命重载错误报告。[插件管理器](../../packages/boot/plugin-manager/README.zh.md) 与 `ocean plugin` 共享包操作和 profile 写锁；更新依赖会保留已停用的组合包选择。CLI 包操作继承认证环境和终端描述符，支持交互式构建批准；service 调用保留清理后的环境并捕获诊断。

安装和 profile 启动会按声明的 `engines.ocean` 范围（未声明时按 OCEAN peer 范围），检查与 `ocean --version` 显示值相同的运行时版本。不兼容插件需要用户明确确认精确版本豁免。[插件管理器的兼容性参考](../../packages/boot/plugin-manager/README.zh.md#version-compatibility-and-exemptions)说明 `version-exemptions`、`allow-version`、`revoke-version`、持久化规则与风险。

配置树以空根为起点，依次叠加以下配置层：
- `ocean.profile.bundles` 中各组合包的 patch
- profile 自身的 `cordis.patch.yml`，然后是 home 级的 `$OCEAN_HOME/cordis.patch.yml`
- `--patch` 指定的覆盖层

`ocean.profile.bundles` 中列出的组合包先从 ocean 安装目录解析（`@ocean/ocean-base`、`@ocean/ocean-web-app`、`@ocean/ocean-headless`、`@ocean/ocean-sdk-app`、`@ocean/ocean-sdk-minimal`、`@ocean/ocean-acp-app`），再从 profile 自身的 `node_modules` 解析；pnpm 会将树外插件安装到该目录。

使用 `--dump-default-config` 和 `--dump-config` 可在不启动的情况下检查组合后的配置树。`--dump-config-schema` 会导入组合树中插件声明的 schema，并打印描述 entry 与 patch 的 JSON Schema，而不是配置值；检查不受信任的插件前，请阅读 [schema dump 的安全性与范围](reference/README.zh.md#config-schema-dump)。

层的确切优先级、flag、关闭行为、部署默认值和源码执行方式，以 [CLI 行为参考](reference/README.zh.md)为准。[启动与重载失败表](../../packages/boot/app-boot/README.zh.md#startup-and-reload-failures)对比 optional、required 插件启动失败与配置 HMR 的行为。

## 可选覆盖层

`config/examples/` 交付 GitHub 评审 webhook、记忆 MCP 服务器与运行时 Cordis 工具的可选覆盖层。它们绝不属于默认 profile；设置与安全说明由[用户指南](../../docs/user/guide/index.zh.md)和[开发实战指南](../../docs/user/develop/practice/index.zh.md)负责。

## 安装包内容

发布 tarball 在 `lib/` 下携带打包后的运行时，在 `src/` 下携带 TypeScript 源码，在各自描述的文件旁携带声明映射与 JavaScript map，并在 `docs/` 下携带文档。只有 `prepack` 会暂存 `docs/`，`postpack` 又会删除这份副本，因此工作树里的读者看到的始终是检出当前的内容。

`docs/` 包含文档网站的页面与全部升级指南，以及这些页面引用的资产。`docs/upgrade-guide/README.md` 在暂存时生成：它按每个 `v<T>` 目录升级前的版本对指南分组，列出每份指南的标题、中英文描述与相对路径。桌面应用在打包的 ocean 运行时中携带同样的 `docs/` 与 `src/`：Linux 上位于 ASAR 外的 `resources/ocean`，macOS 和 Windows 上位于 `resources/app.asar/ocean`。生成的 `persistence-changes/` 记录、`i18n/` 规范与 `*.i18n.yaml` 一致性记录不发布。其中的页面保留仓库的相对链接，因此指向 `../packages/**` 或指向被排除的 `persistence-changes/` 记录的链接只在检出中可解析。

## 开发

生产运行需要已构建的包与前端产物。请在仓库根目录单独运行 `pnpm run build`，然后使用 `pnpm ocean <args...>` 运行 TypeScript 入口并转发所有参数；模块解析约定以[源码执行参考](reference/README.zh.md#source-execution)为准。

`@ocean/ocean/profile-boot` 导出向 Desktop Host 提供共享 profile 生命周期。已解析的应用 profile 为运行时包解析指定自己的安装锚点，同时沿用 Harness home patch、代理环境、遥测开关、patch 热重载和有界关闭。

打包安装通过同一个 `runCli()` 入口传入包管理器可执行文件。Desktop 载体还会启用其已初始化 profile 的插件操作；npm 启动不传入这些选项。安装包提供的包管理环境仅用于插件包操作；调用目录、普通 profile 选择与 agent shell 的 PATH 保留 CLI 语义。

[Web 失败矩阵](tests/profiles/web/tests/web-failure-matrix.expected.e2e.ts)在 `test:expected` 中通过构建后的 CLI 验证启动失败与启用 `awaitWriteFinish` 的原生配置 HMR。它不调用模型 API，而是检查经过认证的 HTTP 响应、诊断、恢复、进程退出与 dispose；[启动验收测试](tests/profiles/web/tests/web-best-effort-startup.expected.e2e.ts)还覆盖随附 Web 的必需依赖与端口冲突。

---
description: "在 Unix 服务器上运行、管理和恢复远程 Ocean Host。"
---

# 指南：部署远程 Host

[English](deploying-remote-host.md) | 中文

## 概述

在 Unix 服务器上运行一个 Ocean Host，并让 Desktop、浏览器或 CLI 使用各自的设备凭据连接。使用专用服务账号保存 Host 数据。停机备份可一并保留会话、附件和设备状态。

## 目录

- [启动 Host](#start-the-host)
- [以服务或容器运行](#run-as-a-service-or-in-a-container)
- [管理设备](#manage-devices)
- [备份、恢复和更新](#back-up-restore-and-update)
- [开发备注](#dev-note)

-----

<a id="start-the-host"></a>
## 启动 Host

安装 [Ocean CLI](../../apps/cli/README.zh.md)及所需的 Node 运行时。使用可读取 TLS 密钥并访问指定工作区的非特权账号运行 Host。设备可以使用该账号的工作区权限执行命令。

在服务器上运行以下示例，将绑定地址和 TLS 路径替换为部署所用的值。客户端 URL 中的主机名应在证书覆盖范围内。

```sh
umask 077
export OCEAN_HOME=/srv/ocean/state
install -d -m 0700 "$OCEAN_HOME" /srv/ocean/run
ocean serve --host 192.0.2.10 --port 8443 --trusted-host ocean.example \
  --tls-cert /srv/ocean/tls/chain.pem --tls-key /srv/ocean/tls/key.pem \
  --device-admin-socket /srv/ocean/run/admin.sock
```

使用同机 HTTPS 反向代理时，绑定 `127.0.0.1`，并将 TLS 参数替换为 `--public-url https://ocean.example/ --trusted-host ocean.example`。保持后端端口私有。代理应保留公共 Host 标头、转发 WebSocket 升级，并在转发前移除外部挂载路径前缀。客户端使用含此前缀的完整公共 URL。

对于已加入 tailnet 且启用了 MagicDNS 和 HTTPS 证书的机器，Tailscale 可以代替证书和代理。无需自己绑定任何地址：`--tailscale-serve` 让监听器保持在回环地址，通过 `tailscale serve` 发布 `https://<node>.<tailnet>.ts.net/`，并在 Host 停止时移除该映射。在 Linux 上，服务账号需要有配置 serve 的权限，例如 `tailscale set --operator=ocean`。如果该节点已经在提供某个目录或文件路径，则只有 root 能修改其 serve 配置；请让 `--tailscale-command` 指向运行 `sudo -n /usr/bin/tailscale "$@"` 的包装脚本。Host 会拒绝已被其他映射占用的端口，因此在已有站点旁请传入空闲的 `--tailscale-serve-port`。tailnet 中的其他设备无需端口转发即可访问该 Host。

```sh
ocean serve --tailscale-serve --device-admin-socket /srv/ocean/run/admin.sock
```

等到出现 `ocean serve:` 就绪行后，再签发令牌。

<a id="run-as-a-service-or-in-a-container"></a>
## 以服务或容器运行

若在同机 HTTPS 代理后运行 Linux 系统服务，将以下内容安装为 `ocean.service`。创建 `ocean` 服务账号，并按实际安装调整 `ExecStart` 和公共地址。systemd 创建私有运行时目录和状态目录。[systemd 执行设置](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)

```ini
[Unit]
Description=Ocean remote Host
After=network.target

[Service]
User=ocean
Group=ocean
StateDirectory=ocean
StateDirectoryMode=0700
RuntimeDirectory=ocean
RuntimeDirectoryMode=0700
UMask=0077
WorkingDirectory=/var/lib/ocean
Environment=OCEAN_HOME=/var/lib/ocean
ExecStart=/usr/local/bin/ocean serve --host 127.0.0.1 --port 8443 --public-url https://ocean.example/ --trusted-host ocean.example --device-admin-socket /run/ocean/admin.sock
Restart=on-failure
TimeoutStopSec=60s

[Install]
WantedBy=multi-user.target
```

在 Linux Docker 主机上，使用包含所选 Ocean 版本和 Node 运行时的本地镜像。此示例在同机反向代理后运行。准备运行 Docker 的账号可写的私有状态目录和运行时目录，并授权该账号访问其他挂载的工作区。[Docker 主机网络](https://docs.docker.com/engine/network/drivers/host/) · [Docker 绑定挂载](https://docs.docker.com/engine/storage/bind-mounts/)

```sh
docker run --name ocean --init --network host --stop-timeout 60 \
  --user "$(id -u):$(id -g)" --workdir /state --env OCEAN_HOME=/state \
  --mount type=bind,source=/srv/ocean/state,target=/state \
  --mount type=bind,source=/srv/ocean/run,target=/run/ocean \
  --entrypoint ocean ocean-local:release \
  serve --host 127.0.0.1 --port 8443 --public-url https://ocean.example/ \
  --trusted-host ocean.example --device-admin-socket /run/ocean/admin.sock
```

<a id="manage-devices"></a>
## 管理设备

以服务账号运行[设备命令](../../apps/cli/README.zh.md)，连接其活动套接字。用 `create <label>` 添加每台设备，用 `list` 检查状态，用 `rotate <id>` 替换令牌，用 `revoke <id>` 禁用设备。通过私有渠道传递 `create` 和 `rotate` 的输出。在 systemd 和容器示例中，使用执行命令时可见的套接字路径。


要在不复制令牌的情况下添加设备，请用一次性配对链接代替 `create`。链接只能使用一次，除非用 `--ttl` 指定，否则十分钟后过期。通过私密渠道发送，然后在设备上打开，或粘贴到 Desktop 的**连接远程 Host**对话框。

```sh
ocean remote-device --socket /run/ocean/admin.sock pair laptop --url https://ocean.example/
```

无法在服务器上打开 shell 为每台设备生成链接时，改为设置一个配对密码。`--password-stdin`（管道或重定向输入）、`--password-env <NAME>` 和 `--clear` 必须且只能提供一个。命令只输出 `Pairing password set.` 或 `Pairing password cleared.`，服务器保存加盐的校验值而不是密码。之后每台设备提交该密码即可配对，以这种方式配对的每台设备都持有全部权限。

```sh
ocean remote-device --socket /run/ocean/admin.sock password --password-stdin
```

将 `DEVICE_ID` 替换为 `list` 返回的标识。

```sh
ocean remote-device --socket /run/ocean/admin.sock create laptop
ocean remote-device --socket /run/ocean/admin.sock list
ocean remote-device --socket /run/ocean/admin.sock rotate DEVICE_ID
ocean remote-device --socket /run/ocean/admin.sock revoke DEVICE_ID
```

<a id="back-up-restore-and-update"></a>
## 备份、恢复和更新

1. 停止 Host 并等待进程退出。在树外的私有目录中归档整个 `OCEAN_HOME`，包括活动 profile 和附件存储。默认提供方将凭据和设备状态保存在 `.credentials.yaml`。另行备份外部凭据存储路径、工作区、TLS 文件和服务配置。
2. 将归档恢复到服务账号拥有的空私有目录。将 `OCEAN_HOME` 指向恢复目录并保留外部 HTTPS 地址。验证恢复期间保留原目录。
3. 验证期间将监听端口保持为私有。比对恢复出的设备列表及备份之后的撤销和轮换记录。在服务重新开放前撤销受影响的设备记录。归档体现其创建时的凭据状态。
4. 打开一个已知 Session，检查附件，并确认活动令牌可以登录、已撤销令牌无法登录。Host 重启后取得新的运行纪元，并保留恢复出的 Host 标识。
5. 更新 Ocean 前，重新进行停机备份。使用相同服务账号和路径启动新版本。就绪后重复登录和 Session 检查。更新失败时，先停止新版本，将对应的更新前备份恢复到空目录，再启动前一版本。

若在同一机器上归档，选择服务账号拥有且已设为私有的目标目录。按凭据要求保护副本。

```sh
umask 077
tar -czf /srv/ocean/backups/pre-update.tgz -C "$OCEAN_HOME" .
install -d -m 0700 /srv/ocean/restored
tar -xzf /srv/ocean/backups/pre-update.tgz -C /srv/ocean/restored
```

<a id="dev-note"></a>
## 开发备注

本指南的活动管理端点是 Unix socket。Windows 可用的本地签发与列举流程见 [CLI 引导模式](../../apps/cli/README.zh.md)；它不提供活动撤销。

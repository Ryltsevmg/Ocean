---
description: "Run, administer, and restore a remote Ocean Host on a Unix server."
---

# Cookbook: deploying a remote Host

English | [中文](deploying-remote-host.zh.md)

## Summary

Run one Ocean Host on a Unix server and connect Desktop, the browser, or CLI with per-device credentials. Keep the Host's data under a dedicated service account. Keep a stopped-state backup so you can recover sessions, attachments, and device state together.

## Table of Contents

- [Start the Host](#start-the-host)
- [Run as a service or in a container](#run-as-a-service-or-in-a-container)
- [Manage devices](#manage-devices)
- [Back up, restore, and update](#back-up-restore-and-update)
- [Dev Note](#dev-note)

-----

## Start the Host

Install the [Ocean CLI](../../apps/cli/README.md) and its required Node runtime. Run the Host as an unprivileged account that can read its TLS key and access the workspaces it should manage. Devices can run commands with that account's workspace permissions.

Run this example on the server. Replace the bind address and TLS paths with your deployment values. Use a hostname in the client URL that the certificate covers.

```sh
umask 077
export OCEAN_HOME=/srv/ocean/state
install -d -m 0700 "$OCEAN_HOME" /srv/ocean/run
ocean serve --host 192.0.2.10 --port 8443 --trusted-host ocean.example \
  --tls-cert /srv/ocean/tls/chain.pem --tls-key /srv/ocean/tls/key.pem \
  --device-admin-socket /srv/ocean/run/admin.sock
```

Behind a same-machine HTTPS reverse proxy, bind to `127.0.0.1` and replace the TLS arguments with `--public-url https://ocean.example/ --trusted-host ocean.example`. Keep the backend port private. Preserve the public Host header, forward WebSocket upgrades, and strip any external mount prefix before forwarding. Supply the full public URL, including that prefix, to clients.

On a machine that joined a tailnet with MagicDNS and HTTPS certificates enabled, Tailscale can replace the certificate and proxy. Bind nothing yourself: `--tailscale-serve` keeps the listener on loopback, publishes `https://<node>.<tailnet>.ts.net/` through `tailscale serve`, and removes that mapping when the Host stops. On Linux the service account needs permission to configure serve, for example `tailscale set --operator=ocean`. If the node already serves a directory or file path, only root can change its serve configuration; point `--tailscale-command` at a wrapper that runs `sudo -n /usr/bin/tailscale "$@"`. The Host refuses a port that another mapping already uses, so pass a free `--tailscale-serve-port` beside an existing site. Other devices on the tailnet reach the Host without port forwarding.

```sh
ocean serve --tailscale-serve --device-admin-socket /srv/ocean/run/admin.sock
```

Wait for the `ocean serve:` readiness line before issuing a token.

## Run as a service or in a container

For a Linux system service behind a same-machine HTTPS proxy, install this as `ocean.service`. Create the `ocean` service account and adjust `ExecStart` and the public address to match your installation. systemd creates private runtime and state directories. [systemd execution settings](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)

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

For a Linux Docker host, use a local image containing the selected Ocean release and Node runtime. The example runs behind a reverse proxy on the same host. Prepare private state and runtime directories writable by the account running Docker, and grant that account access to any additional mounted workspaces. [Docker host networking](https://docs.docker.com/engine/network/drivers/host/) · [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)

```sh
docker run --name ocean --init --network host --stop-timeout 60 \
  --user "$(id -u):$(id -g)" --workdir /state --env OCEAN_HOME=/state \
  --mount type=bind,source=/srv/ocean/state,target=/state \
  --mount type=bind,source=/srv/ocean/run,target=/run/ocean \
  --entrypoint ocean ocean-local:release \
  serve --host 127.0.0.1 --port 8443 --public-url https://ocean.example/ \
  --trusted-host ocean.example --device-admin-socket /run/ocean/admin.sock
```

## Manage devices

Run the [device commands](../../apps/cli/README.md) as the service account against its active socket. Use `create <label>` for each device, `list` to inspect status, `rotate <id>` to replace a token, and `revoke <id>` to disable it. Send the output of `create` and `rotate` through a private channel. In the systemd and container examples, use the socket path visible to the command you run.

To add a device without copying its token, create a one-time pairing link instead of `create`. The link works once and expires after ten minutes unless `--ttl` says otherwise. Send it through a private channel, then open it on the device or paste it into Desktop’s **Connect to remote Host** dialog.

```sh
ocean remote-device --socket /run/ocean/admin.sock pair laptop --url https://ocean.example/
```

When you cannot open a shell on the server to make a link for each device, set one pairing password instead. Supply exactly one of `--password-stdin` (a pipe or redirected input), `--password-env <NAME>`, or `--clear`. The command prints only `Pairing password set.` or `Pairing password cleared.`, and the server keeps a salted verifier rather than the password. Each device then pairs by presenting the password, and every device paired this way holds every right.

```sh
ocean remote-device --socket /run/ocean/admin.sock password --password-stdin
```

Replace `DEVICE_ID` with an identifier from `list`.

```sh
ocean remote-device --socket /run/ocean/admin.sock create laptop
ocean remote-device --socket /run/ocean/admin.sock list
ocean remote-device --socket /run/ocean/admin.sock rotate DEVICE_ID
ocean remote-device --socket /run/ocean/admin.sock revoke DEVICE_ID
```

## Back up, restore, and update

1. Stop the Host and wait for it to exit. Archive all of `OCEAN_HOME` in a private directory outside that tree. Include the active profile and attachment store. The default provider stores credentials and device state in `.credentials.yaml`. Archive any external credential-store path, workspaces, TLS files, and service configuration separately.
2. Restore the archive into an empty private directory owned by the service account. Point `OCEAN_HOME` at the restored directory and preserve the external HTTPS address. Keep the original directory while validating recovery.
3. Keep the listener private during validation. Compare the restored device list with your later revocations and rotations. Revoke affected device records before making the service reachable again. An archive reflects the credential state at its creation time.
4. Open a known Session, check its attachments, and confirm that an active token works and a revoked token fails. A restarted Host gets a new runtime epoch and retains the restored Host identity.
5. Before updating Ocean, take a fresh stopped backup. Start the new release with the same service account and paths. After readiness, repeat the login and Session checks. To recover from a failed update, stop it and restore the matching pre-update backup into an empty directory before starting the previous release.

For an archive on the same machine, use a destination directory that the service account owns and has already made private. Protect copies as credentials.

```sh
umask 077
tar -czf /srv/ocean/backups/pre-update.tgz -C "$OCEAN_HOME" .
install -d -m 0700 /srv/ocean/restored
tar -xzf /srv/ocean/backups/pre-update.tgz -C /srv/ocean/restored
```

<a id="dev-note"></a>
## Dev Note

The live administrator endpoint in this cookbook is a Unix socket. [CLI bootstrap mode](../../apps/cli/README.md) also supports local issuance and inventory on Windows; it does not perform live revocation.

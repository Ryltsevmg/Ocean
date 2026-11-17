#!/bin/sh
set -eu
ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/ssh_host_ed25519_key
install -d -m 700 -o ocean -g ocean /home/ocean/.ssh
install -m 600 -o ocean -g ocean /fixture-key.pub /home/ocean/.ssh/authorized_keys
install -d -m 700 -o ocean -g ocean /home/ocean/workspace
exec /usr/sbin/sshd -D -e -f /etc/ssh/sshd_config

<a id="uninstall-ocean-desktop"></a>

# Desinstalar o Ocean Desktop

<!-- USER_LANGUAGES_START -->
[English](desktop-uninstall-cleanup.md) | [中文](desktop-uninstall-cleanup.zh.md) | [Русский](desktop-uninstall-cleanup.ru.md) | [日本語](desktop-uninstall-cleanup.ja.md) | [Español](desktop-uninstall-cleanup.es.md) | [Français](desktop-uninstall-cleanup.fr.md) | [Deutsch](desktop-uninstall-cleanup.de.md) | Português | [한국어](desktop-uninstall-cleanup.ko.md)
<!-- USER_LANGUAGES_END -->

Use este guia para desinstalar o Ocean Desktop no macOS, Windows ou Linux. A limpeza dos dados locais é opcional.

<a id="1-uninstall-the-app"></a>

## 1. Desinstalar o aplicativo

Conclua todos os comandos que usam a CLI incluída no Desktop. Se você instalou o comando `ocean` pelo Desktop, primeiro selecione **Manage ocean Command… → Remove** no menu do aplicativo. Isso remove o registro do comando do Desktop sem desinstalar programas CLI independentes.

Feche o Ocean e desinstale-o pelo procedimento da sua plataforma:

- **macOS:** Exclua o aplicativo da pasta Aplicativos no Finder.
- **Windows:** Desinstale em Configurações → Aplicativos → Aplicativos instalados no Windows 11, ou no Painel de Controle → Programas → Programas e Recursos.
- **Linux:** Remova a instalação usando o mesmo método usado para instalá-la; se extraiu um diretório, feche o aplicativo e remova esse diretório de instalação.

<a id="2-inspect-local-data-before-cleanup"></a>

## 2. Inspecionar os dados locais antes da limpeza

Excluir dados locais pode remover permanentemente sessões, credenciais, configurações, plugins, caches e estado compartilhado da CLI. Faça backup do que quiser manter. Não exclua um diretório apenas porque seu nome se parece com Ocean ou OCEAN.

A pasta padrão atual do Ocean é `~/.ocean`, ou `.ocean` dentro do perfil de usuário do Windows. `OCEAN_HOME` pode selecionar outro local; inspecione a configuração usada para iniciar o Desktop, que pode ser diferente da do terminal atual. Os comandos abaixo apenas exibem possíveis locais e não excluem nada. Eles não descobrem o diretório `userData` real do Electron nem todos os caches específicos da instalação.

::: code-group

```sh [macOS]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${OCEAN_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: $HOME/Library/Caches/@oceanocean-desktop-updater"
# Previous-release ~/.ocean and donor-era appId caches require separate ownership checks.
```

```powershell [Windows]
$ErrorActionPreference = 'Stop'
if (-not $env:USERPROFILE -or -not $env:LOCALAPPDATA) {
    throw 'USERPROFILE and LOCALAPPDATA must be set.'
}
$oceanHome = if ($env:OCEAN_HOME) { $env:OCEAN_HOME } else { Join-Path $env:USERPROFILE '.ocean' }
"Ocean home candidate: $oceanHome"
"Updater cache candidate: $(Join-Path $env:LOCALAPPDATA '@oceanocean-desktop-updater')"
# Previous-release .ocean and @deepseek-ai data are NOT removed.
# Inspect them separately; delete only data you recognize and no longer need.
```

```sh [Linux]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${OCEAN_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: ${XDG_CACHE_HOME:-$HOME/.cache}/@oceanocean-desktop-updater"
# Previous-release ~/.ocean requires a separate ownership check.
```

:::

O nome do cache do atualizador é derivado do nome do pacote Desktop, não do nome do produto. Esses locais correspondem ao pacote atual `@ocean/ocean-desktop`; outras compilações podem ser diferentes. No Windows, o [desinstalador](../../../apps/desktop/installer/uninstall.nsh) verifica os diretórios de dados do aplicativo baseados no nome do produto e do pacote, além do cache do atualizador, mas preserva a pasta do Ocean; atualizações e reinstalações com retenção de dados também podem preservar os dados do aplicativo.

Encontre os diretórios reais de dados e registros do Electron para sua instalação antes de removê-los; a [referência de diagnóstico](../../../apps/desktop/docs/diagnostics/README.md#report-contents) descreve os locais dos registros. Os nomes de preferências, ShipIt, armazenamento HTTP e caches do sistema no macOS dependem do identificador do pacote instalado. O empacotamento exige um `OCEAN_DESKTOP_APP_ID` explícito; `com.deepseek.ocean` não é um identificador universal do Ocean. Não execute uma limpeza com curingas para esse identificador, a menos que tenha confirmado separadamente que esses arquivos são resíduos da instalação anterior.

`~/.ocean` era um local padrão anterior, não o atual. Exclua essa pasta, os dados antigos de aplicativos `@deepseek-ai` ou os caches de identificadores do projeto original somente se reconhecer esses resíduos e nenhuma outra instalação precisar deles. Diretórios de desenvolvimento e testes exigem verificações próprias.

<a id="3-remove-verified-data-and-check"></a>

## 3. Remover os dados verificados e conferir

Após confirmar cada caminho exato e a qual instalação ele pertence, use o gerenciador de arquivos para remover apenas os diretórios que você escolheu. Deixe intactos os caminhos que você não reconhece. Confirme que os caminhos escolhidos não existem mais antes de reinstalar. Se a remoção apresentar um erro, inspecione os arquivos restantes e resolva o erro em vez de ampliar o alvo da exclusão.

<a id="uninstall-ocean-desktop"></a>

# Ocean Desktop 제거

<!-- USER_LANGUAGES_START -->
[English](desktop-uninstall-cleanup.md) | [中文](desktop-uninstall-cleanup.zh.md) | [Русский](desktop-uninstall-cleanup.ru.md) | [日本語](desktop-uninstall-cleanup.ja.md) | [Español](desktop-uninstall-cleanup.es.md) | [Français](desktop-uninstall-cleanup.fr.md) | [Deutsch](desktop-uninstall-cleanup.de.md) | [Português](desktop-uninstall-cleanup.pt.md) | 한국어
<!-- USER_LANGUAGES_END -->

이 가이드는 macOS, Windows, Linux에서 Ocean Desktop을 제거하는 방법을 안내합니다. 로컬 데이터 정리는 선택 사항입니다.

<a id="1-uninstall-the-app"></a>

## 1. 앱 제거

Desktop에 포함된 CLI를 사용하는 명령을 모두 종료하세요. Desktop에서 `dsh` 명령을 설치했다면 먼저 앱 메뉴에서 **Manage dsh Command… → Remove**를 선택하세요. Desktop의 명령 등록만 제거되며, 독립적으로 설치된 CLI 프로그램은 제거되지 않습니다.

Ocean을 종료한 뒤 플랫폼별 절차로 제거하세요:

- **macOS:** Finder의 응용 프로그램에서 앱을 삭제하세요.
- **Windows:** Windows 11의 설정 → 앱 → 설치된 앱, 또는 제어판 → 프로그램 → 프로그램 및 기능에서 제거하세요.
- **Linux:** 설치에 사용한 방법으로 제거하세요. 압축을 푼 디렉터리에서 실행했다면 앱을 종료한 후 해당 설치 디렉터리를 삭제하세요.

<a id="2-inspect-local-data-before-cleanup"></a>

## 2. 정리 전 로컬 데이터 확인

로컬 데이터를 삭제하면 세션, 인증 정보, 설정, 플러그인, 캐시, 공유 CLI 상태가 영구적으로 사라질 수 있습니다. 보관할 데이터는 백업하세요. 이름이 Ocean 또는 DSH와 비슷하다는 이유만으로 디렉터리를 삭제하지 마세요.

현재 Ocean의 기본 홈은 `~/.ocean`이며, Windows에서는 사용자 프로필 아래의 `.ocean`입니다. `DSH_HOME`으로 다른 위치를 지정할 수 있습니다. 현재 터미널과 다를 수 있으므로 Desktop 실행에 사용한 설정을 확인하세요. 아래 명령은 후보 위치만 출력하며 아무것도 삭제하지 않습니다. Electron의 실제 `userData` 디렉터리나 설치별 캐시를 모두 찾아내지는 않습니다.

::: code-group

```sh [macOS]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${DSH_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: $HOME/Library/Caches/@oceanocean-desktop-updater"
# Previous-release ~/.dsh and donor-era appId caches require separate ownership checks.
```

```powershell [Windows]
$ErrorActionPreference = 'Stop'
if (-not $env:USERPROFILE -or -not $env:LOCALAPPDATA) {
    throw 'USERPROFILE and LOCALAPPDATA must be set.'
}
$oceanHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.ocean' }
"Ocean home candidate: $oceanHome"
"Updater cache candidate: $(Join-Path $env:LOCALAPPDATA '@oceanocean-desktop-updater')"
# Previous-release .dsh and @deepseek-ai data are NOT removed.
# Inspect them separately; delete only data you recognize and no longer need.
```

```sh [Linux]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${DSH_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: ${XDG_CACHE_HOME:-$HOME/.cache}/@oceanocean-desktop-updater"
# Previous-release ~/.dsh requires a separate ownership check.
```

:::

업데이터 캐시 이름은 제품명이 아니라 Desktop 패키지 이름에서 정해집니다. 이 후보 경로는 현재 `@ocean/ocean-desktop` 패키지를 기준으로 하며 다른 빌드에서는 다를 수 있습니다. Windows [제거 프로그램](../../../apps/desktop/installer/uninstall.nsh)은 제품명 및 패키지명 기반 앱 데이터 디렉터리와 업데이터 캐시를 확인하지만 Ocean 홈은 유지합니다. 업데이트나 데이터를 유지하는 재설치에서도 앱 데이터가 보존될 수 있습니다.

삭제하기 전에 해당 설치에서 실제로 사용하는 Electron 데이터 및 로그 디렉터리를 찾으세요. 로그 위치는 [진단 참조](../../../apps/desktop/docs/diagnostics/README.md#report-contents)에 설명되어 있습니다. macOS 환경설정, ShipIt, HTTP 저장소, 시스템 캐시 이름은 설치된 번들 식별자에 따라 달라집니다. 패키징에는 명시적인 `DSH_DESKTOP_APP_ID`가 필요하며, `com.deepseek.dsh`는 모든 Ocean 설치에 공통인 식별자가 아닙니다. 해당 파일이 이전 설치의 잔여물임을 별도로 확인하지 않았다면 그 식별자를 대상으로 와일드카드 정리를 실행하지 마세요.

`~/.dsh`는 이전 기본값이며 현재 기본값이 아닙니다. 이 디렉터리, 이전 `@deepseek-ai` 앱 데이터, 원본 프로젝트 시절 식별자의 캐시는 잔여물임을 알고 다른 설치에서 필요하지 않을 때만 삭제하세요. 개발 및 테스트 디렉터리는 별도로 확인해야 합니다.

<a id="3-remove-verified-data-and-check"></a>

## 3. 확인된 데이터 삭제 및 점검

각 경로와 소유 대상을 정확히 확인한 후 파일 관리자로 선택한 디렉터리만 삭제하세요. 알 수 없는 경로는 그대로 두세요. 재설치 전에 선택한 경로가 더 이상 존재하지 않는지 확인하세요. 삭제 중 오류가 발생하면 삭제 대상을 넓히지 말고 남은 파일을 살펴 오류를 해결하세요.

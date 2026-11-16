<a id="run-dsh-behind-a-network-proxy"></a>

# Executar o DSH atrás de um proxy de rede

<!-- USER_LANGUAGES_START -->
[English](network-proxy.md) | [中文](network-proxy.zh.md) | [Русский](network-proxy.ru.md) | [日本語](network-proxy.ja.md) | [Español](network-proxy.es.md) | [Français](network-proxy.fr.md) | [Deutsch](network-proxy.de.md) | Português | [한국어](network-proxy.ko.md)
<!-- USER_LANGUAGES_END -->

O DSH encaminha suas solicitações de saída —chamadas a modelos, buscas na web, obtenção de páginas e conexões HTTP a servidores MCP— pelo proxy indicado nas variáveis de ambiente padrão de proxy. Ele as lê na inicialização; não é necessário configurar mais nada. Algumas rotas permanecem diretas por projeto ou por limitações do ambiente de execução; elas estão listadas em «O que continua direto» abaixo.

<a id="export-the-variables"></a>

## Exportar as variáveis

```sh
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

Coloque as duas linhas no perfil do shell para que toda chamada de `dsh` as herde, ou em `$DSH_HOME/.env` (`~/.dsh/.env` por padrão), junto da chave API; uma variável exportada sempre tem prioridade sobre esse arquivo. O `.env` do próprio projeto não pode defini-las: ele vem com `git clone`, e o DSH se recusa a iniciar em vez de permitir que um repositório decida para onde seu tráfego vai.

Se o proxy precisar de credenciais, elas entram na URL: `http://user:password@proxy.example:8080`. O DSH nunca exibe essa URL: o diagnóstico indica a variável rejeitada, portanto nem o nome de usuário nem a senha aparecem.

<a id="why-your-browser-is-proxied-but-your-terminal-is-not"></a>

## Por que o navegador usa o proxy, mas o terminal não

Essa é a surpresa mais comum e não é específica do DSH. Não existe um único «proxy do sistema» seguido por todos os programas: há três mecanismos independentes:

| Mecanismo | Quem o utiliza |
|---|---|
| Configurações de proxy do sistema operacional | Safari, a maioria dos aplicativos nativos do macOS, Chrome e Edge |
| Variáveis de ambiente `HTTP_PROXY` / `HTTPS_PROXY` | `curl`, `git`, `npm`, `pip` e DSH |
| Modo TUN (uma interface de rede virtual) | Tudo, de forma transparente |

A opção «proxy do sistema» em um aplicativo de proxy como o Clash altera apenas o primeiro mecanismo. Os navegadores a detectam; as ferramentas de linha de comando não a veem. Por isso exportar as variáveis é uma etapa separada, e ativar o modo TUN faz os dois funcionarem sem nenhuma variável.

O DSH não lê as configurações de proxy do sistema operacional. Exporte as variáveis ou use o modo TUN.

<a id="choose-what-stays-direct"></a>

## Escolher o que continua direto

`NO_PROXY` lista os hosts acessados diretamente:

```sh
export NO_PROXY=internal.example.com,.corp.example.com,registry.local
```

Uma entrada indica um host e corresponde tanto a ele quanto a todos os seus subdomínios: `NO_PROXY=example.com` também envia `api.example.com` diretamente. Um prefixo `.` ou `*.` é aceito e tem o mesmo significado. A entrada pode incluir `:port`, e `*` ignora o proxy para tudo.

**Intervalos CIDR não funcionam.** A lista de exceções do sistema operacional costuma incluir entradas como `10.0.0.0/8` ou `192.168.0.0/16`; copiá-las para `NO_PROXY` não tem efeito. Use nomes de host ou sufixos de domínio.

Não é necessário listar `localhost` ou `127.0.0.1`. O DSH sempre ignora o proxy para loopback, pois, caso contrário, sua interface web e os servidores locais passariam pelo proxy e criariam um ciclo.

<a id="limits-worth-knowing"></a>

## Limitações importantes

**Proxies SOCKS não são compatíveis.** Um valor `socks5://` é informado na inicialização e ignorado, e o DSH conecta diretamente para o esquema que o definiu: configurar `HTTPS_PROXY=socks5://…` junto de um `HTTP_PROXY` válido mantém `https:` direto, sem aproveitar o proxy HTTP. Aponte as variáveis para a porta HTTP do seu aplicativo de proxy: a maioria oferece ambas, e a porta HTTP costuma ter um número próximo.

**Somente `ALL_PROXY` é suficiente.** O DSH o usa como alternativa para os dois esquemas, embora Node e curl se comportem de forma diferente nesse ponto. Ainda é mais claro definir `HTTPS_PROXY` explicitamente.

**Um proxy corporativo que intercepta TLS precisa de seu certificado.** Se as solicitações falharem com erro de certificado quando o proxy já estiver acessível, indique ao Node o pacote de CAs da sua organização antes de iniciar:

```sh
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
```

O Node lê essa variável apenas ao iniciar o processo, então exporte-a antes de executar `dsh`.

**As ferramentas que o DSH executa para você seguem o mesmo proxy.** Os comandos na ferramenta bash, `git`, `gh` e servidores MCP iniciados como processos filhos herdam essas variáveis. Um programa Node filho usa seu próprio ambiente de execução instalado: Node 22.21+ e Node 24+ respeitam essas variáveis; versões anteriores conectam diretamente. Se uma variável de proxy tiver um valor rejeitado pelo DSH —uma URL SOCKS, por exemplo—, ferramentas baseadas em Node também conectam diretamente em vez de falhar ao iniciar, enquanto `curl` e `git` continuam lendo esse valor.

**Uma senha na URL do proxy também chega a essas ferramentas.** `HTTPS_PROXY=http://alice:s3cret@proxy.example:8080` é uma variável de ambiente normal; portanto, qualquer comando executado pelo DSH —inclusive os escritos pelo modelo— pode lê-la. Um comando que exibe seu ambiente coloca a senha em uma saída que é mantida. É assim que essa variável já se comporta para os demais programas no shell. Se isso for um problema, ofereça um ponto de entrada do proxy sem credenciais ou autentique de outra forma que não seja pela URL.

<a id="what-stays-direct"></a>

## O que continua direto

Nem toda solicitação do DSH passa pelo proxy:

- **Tudo que está nesta máquina.** Loopback é sempre direto: `localhost`, todo o intervalo `127.0.0.0/8`, `::1` e `0.0.0.0`. Um proxy não consegue acessar de forma útil um serviço que só escuta localmente.
- **Código escrito pelo modelo.** Workers de fluxos de trabalho e processos Node do ptc-runtime não recebem configurações de proxy, para que scripts escritos pelo modelo não possam ler uma URL de proxy que talvez contenha uma senha. Solicitações diretas devem configurar por conta própria o proxy necessário e continuam sujeitas ao isolamento de execução.
- **Telemetria de uso.** O exportador OTLP usa o cliente HTTP do próprio Node em vez daquele configurado pelo proxy; portanto, a telemetria conecta diretamente e simplesmente falha quando a saída direta é bloqueada. Nada que você faz no DSH depende dela. Defina `DSH_TELEMETRY_MODE=DISABLED` para desativá-la completamente.
- **`web_fetch` para um endereço privado literal.** Uma URL com um endereço como `http://10.0.0.5/` é recusada em vez de ser enviada ao proxy, da mesma forma que quando nenhum proxy está configurado.

<a id="check-that-it-worked"></a>

## Verificar se funcionou

Peça ao agente para obter uma página e observe o registro de conexões do aplicativo de proxy:

```sh
dsh --profile headless "fetch https://example.com and tell me the page title"
```

Se a solicitação não aparecer, confirme que as variáveis chegam ao ambiente do próprio DSH:

```sh
env | grep -i proxy
```

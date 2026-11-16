<a id="publish-the-web-ui-behind-a-reverse-proxy"></a>

# Publicar a interface web atrás de um proxy reverso

<!-- USER_LANGUAGES_START -->
[English](public-deployments.md) | [中文](public-deployments.zh.md) | [Русский](public-deployments.ru.md) | [日本語](public-deployments.ja.md) | [Español](public-deployments.es.md) | [Français](public-deployments.fr.md) | [Deutsch](public-deployments.de.md) | Português | [한국어](public-deployments.ko.md)
<!-- USER_LANGUAGES_END -->

`dsh --profile web` serve a interface gráfica em uma porta loopback, portanto um navegador em outra máquina não consegue acessá-la, e o processo desconhece o endereço que você usa. Um proxy reverso à frente dela cuida desse trecho externo: o nome público do host, TLS e o prefixo de caminho removido antes de encaminhar ao servidor. `--public-url` informa ao DSH qual endereço os navegadores usam:

```sh
dsh --profile web --public-url https://app.example/ui/ --trusted-host app.example
```

<a id="what---public-url-advertises"></a>

## O que `--public-url` anuncia

`--public-url` aceita uma raiz `http://` ou `https://` com um prefixo de montagem opcional e a normaliza para terminar em `/`. Ela fornece a URL exibida e aberta na inicialização, `DSH_WEB_URL` e a URL da interface web no contexto de execução do agente. O servidor web continua servindo rotas a partir da raiz da origem e não conhece o ponto de montagem. O campo de configuração `publicUrl` publica o mesmo anúncio.

<a id="what-the-proxy-must-do"></a>

## O que o proxy deve fazer

- **Preservar o `Host` visível ao navegador.** A verificação de acesso compara o `Host` recebido com as autoridades aceitas; portanto, o proxy deve encaminhá-lo sem alterações em vez de substituí-lo pelo endereço do servidor.
- **Remover o prefixo de montagem.** O servidor responde a rotas a partir da raiz da origem, então uma solicitação a `/ui/api/...` deve chegar como `/api/...`.
- **Encaminhar mudanças de protocolo.** Toda solicitação e mudança para WebSocket aberta pela página deve chegar ao servidor com os cabeçalhos `Upgrade` e `Connection` intactos; TLS termina no trecho externo do proxy quando ele serve HTTPS.
- **Reescrever o escopo dos cookies.** Um backend com HTTP sem criptografia emite cookies restritos ao host, com `Path=/` e sem `Secure`; o proxy reescreve `Path` para o ponto de montagem (`/ui/`) e adiciona `Secure` no trecho HTTPS. Um servidor backend com TLS próprio já marca o cookie como `Secure`, então o proxy só reescreve `Path`.
- **Redirecionar o ponto de montagem sem barra.** `/ui/` é a única entrada: somente ela troca o token de inicialização pelo cookie de sessão, e ela ou `/ui/index.html` servem o documento a um navegador que já tem esse cookie, pois o documento resolve URLs em relação ao próprio diretório. Uma solicitação a `/ui` deve chegar como `/ui/`, e o backend sem prefixo não consegue reconstruir esse caminho externo.

<a id="trust-the-authority-browsers-use"></a>

## Confiar na autoridade usada pelos navegadores

A verificação de acesso aceita loopback, o endereço de escuta do próprio servidor e todas as autoridades indicadas por `--trusted-host`. Um navegador que acessa a implantação por outra autoridade recebe 403 em todas as chamadas API, mesmo com o proxy correto. Por isso, indique a autoridade visível ao navegador com `--trusted-host`; anunciá-la com `--public-url` apenas a exibe, não a autoriza. Uma entrada sem porta corresponde a qualquer porta, o que atende a túneis que usam uma porta diferente a cada vez. A verificação apenas admite a solicitação; o token de inicialização na URL exibida e o cookie de sessão assinado fazem a autenticação. TLS, onde quer que termine, não altera isso: o certificado identifica o servidor para o navegador, não o navegador para o servidor.

Nem a URL anunciada nem a verificação protegem a própria porta de escuta, então restrinja essa porta ao proxy ou à rede confiável.

<a id="secure-the-external-leg"></a>

## Proteger o trecho externo

Termine TLS no proxy, no próprio servidor ou em ambos; `--public-url` continua sendo apenas um anúncio. Uma raiz `http://` visível ao navegador expõe o token de inicialização em texto aberto. Uma raiz `https://` no proxy protege o trecho entre navegador e proxy; a criptografia entre proxy e servidor depende da configuração TLS do servidor.

Para terminar TLS no servidor, passe `--tls-cert` e `--tls-key`, cada um com um caminho resolvido em relação ao diretório de trabalho do processo: o arquivo de certificado contém a cadeia completa, e o arquivo de chave contém uma chave privada PEM não criptografada. O DSH não obtém, renova nem monitora certificados, e o executável lê os arquivos uma única vez; para alterá-los, substitua-os e recarregue o servidor ou reinicie o processo. A inicialização falha se o par estiver ausente ou inválido e nunca recorre a HTTP. O navegador aplica seu próprio armazenamento de confiança e suas verificações de nome, então o certificado deve cobrir o hostname ou IP aberto. A porta padrão continua sendo 3080. TLS nativo não precisa de proxy, mas implantações com proxy e `--public-url` continuam compatíveis de forma independente. Um servidor TLS marca cookies de sessão como `Secure`; mantenha HTTPS no trecho público voltado ao navegador para que ele possa devolver esses cookies.

A URL exibida contém uma credencial do processo; compartilhe-a apenas com os usuários pretendidos.

A [referência do aplicativo web](../../../packages/bundle/web-app/README.md#public-deployments) documenta as opções de linha de comando `--public-url`, `--trusted-host` e `--tls-cert`/`--tls-key`. No perfil Web, `publicUrl` configura a entrada `web-runtime`, `trustedHosts` configura a [entrada Connection](../../../packages/client/connection/README.md), e `tls` configura a [entrada webserver](../../../docs/subsystems/web-server.md#config).

<a id="connect-a-third-party-memory-mcp-server"></a>

# Conectar un servidor MCP de memoria de terceros

<!-- USER_LANGUAGES_START -->
[English](mcp-memory.md) | [中文](mcp-memory.zh.md) | [Русский](mcp-memory.ru.md) | [日本語](mcp-memory.ja.md) | Español | [Français](mcp-memory.fr.md) | [Deutsch](mcp-memory.de.md) | [Português](mcp-memory.pt.md) | [한국어](mcp-memory.ko.md)
<!-- USER_LANGUAGES_END -->

Estas tres **configuraciones de referencia desactivadas por defecto** conectan un sistema de memoria a DSH mediante [`@ocean/ocean-mcp-client`](../../../packages/mcp/mcp-client/README.md). Elige una o copia la misma entrada MCP genérica para otro servidor.

Estas configuraciones de terceros se ofrecen únicamente como ejemplos de interoperabilidad. Su inclusión no implica respaldo, recomendación, colaboración ni soporte continuo por parte del proyecto Ocean.

<a id="what-dsh-does"></a>

## Qué hace DSH

DSH analiza la superposición Cordis elegida, inicia un comando stdio configurado o se conecta a una URL Streamable HTTP configurada, descubre las herramientas MCP y las expone como `mcp__<serverName>__<tool>`. DSH **no** descarga el servidor, inicializa su base de datos, elige su proveedor de modelos o embeddings, crea una cuenta en la nube, migra datos del proveedor ni supervisa un servicio HTTP independiente. Para stdio, el cliente genérico inicia y detiene el proceso hijo con el ciclo de vida del plugin DSH; para HTTP, el servicio externo debe estar ya en ejecución.

El puente stdio elimina deliberadamente las variables del entorno cuyos nombres suelen identificar credenciales y todas las variables `DSH_*` antes de iniciar un proceso hijo; el resto se hereda. Cada ejemplo añade solo la configuración mínima que necesita. Si una función opcional del servidor necesita otro secreto, añade esa variable a `config.env` de la entrada en lugar de incluir el secreto directamente en YAML.

<a id="choose-one"></a>

## Elegir un sistema

| Sistema | Versión fijada y probada | Transporte | Requisito del proveedor |
|---|---:|---|---|
| [Memorix](https://github.com/AVIDS2/memorix) | `memorix@1.3.0` (`500792cad3144142293bfbb20acb4841c9f7fcfa`) | stdio | Node 22.18+ y `npm install --global memorix@1.3.0` |
| [MCP Reference Memory](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | `@modelcontextprotocol/server-memory@2026.7.4` (`6dd0a683e198783e30feabf7abaf42f925bd18b1`) | stdio | `npm install --global @modelcontextprotocol/server-memory@2026.7.4` |
| [Engram](https://github.com/Gentleman-Programming/engram) | `v1.20.0` (`ba9e46ced152c37a7cb9e576153c41995873e2fc`) | stdio | Go 1.25.10+ y `go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0`, o el binario de la versión correspondiente |

<a id="enable-one"></a>

## Activar un sistema

Pasa una superposición a DSH:

```sh
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Sustituye el nombre del archivo por `mcp-reference-memory.cordis.yml` o `engram.cordis.yml`. La ruta puede apuntar a una copia del archivo en cualquier lugar del disco. La composición distribuida no incluye ningún servidor de memoria, por lo que omitir `--patch` mantiene los tres desactivados.

Para conservar la selección entre ejecuciones, integra el único parche `insert` del archivo elegido en una capa de parches de usuario: `$DSH_HOME/profiles/<name>/cordis.patch.yml` para un perfil, o `$DSH_HOME/cordis.patch.yml` para todos los perfiles del equipo. No sobrescribas un archivo existente: puede contener otros parches del usuario.

<a id="provider-setup"></a>

## Configuración de proveedores

### Memorix

```sh
npm install --global memorix@1.3.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Memorix funciona en modo heurístico local sin un LLM ni un servicio de embeddings. Configura los proveedores opcionales en su propio `~/.memorix/config.toml` o en el `memorix.toml` del proyecto. El ejemplo conserva la identidad del proyecto Git que Memorix obtiene del directorio de trabajo de DSH y usa la ubicación predeterminada `~/.memorix/data` de Memorix. Define `MEMORIX_DATA_DIR` antes de iniciar DSH para cambiarla.

### MCP Reference Memory

```sh
npm install --global @modelcontextprotocol/server-memory@2026.7.4
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/mcp-reference-memory.cordis.yml"
```

Este servidor de referencia guarda un grafo de conocimiento local y expone herramientas de entidades, relaciones, observaciones, lectura, búsqueda y apertura. No necesita un modelo ni un servicio de embeddings. El ejemplo guarda su JSONL en `$HOME/.dsh-mcp-reference-memory.jsonl` en lugar del directorio del paquete npm instalado. Define `MEMORY_FILE_PATH` antes de iniciar DSH para cambiarlo.

La búsqueda compara subcadenas sin distinguir mayúsculas y minúsculas en los nombres, tipos y observaciones de las entidades; no es una recuperación semántica. El servidor no añade embeddings, resúmenes automáticos, resolución de conflictos ni una política de olvido.

### Engram

```sh
go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/engram.cordis.yml"
```

Engram gestiona el almacenamiento y la selección del proyecto: usa `~/.engram` por defecto, detecta el proyecto Git a partir del directorio de trabajo de DSH y admite `ENGRAM_DATA_DIR` o `ENGRAM_PROJECT` como variables del entorno para cambiar esos valores.

<a id="optional-shared-model-instruction"></a>

## Instrucción compartida opcional para el modelo

Añade esta instrucción breve e independiente del proveedor a tus instrucciones actuales del modelo si las descripciones de las herramientas del servidor no activan el uso de la memoria de forma fiable:

> Cuando el usuario te pida recordar algo, llama a una herramienta de escritura de memoria. Cuando la información histórica pueda ser relevante, busca en la memoria y utiliza los resultados pertinentes.

Es solo una indicación adicional. Los ejemplos no sustituyen la personalidad definida en el prompt del sistema de DSH.

<a id="verify-write-fresh-session-recall-and-use"></a>

## Verificar escritura, recuperación en una sesión nueva y uso

Usa un valor único y mantén el mismo ámbito de almacenamiento del proveedor durante toda la prueba:

1. En la sesión A de DSH, pide: `Remember that my validation drink is lapsang-<unique suffix>.` Confirma que el modelo llamó a la herramienta de escritura del proveedor y que esta devolvió un resultado satisfactorio.
2. Crea la sesión B de DSH en el mismo Host en ejecución. No copies la conversación de la sesión A. Pregunta: `What is my validation drink? Check memory.` Confirma que el modelo llamó a la herramienta de búsqueda o recuperación del proveedor y devolvió el valor.
3. En la misma sesión B, pide: `Use that preference to suggest one drink for the meeting.` Confirma que la respuesta utiliza el valor recuperado.

Se necesita una sesión DSH nueva, pero no reiniciar el Host. Si un proceso MCP hijo falla, se activa la reconexión automática con espera progresiva y una resincronización de herramientas; las herramientas siguen listadas y las llamadas solo fallan durante la interrupción. Al agotarse el presupuesto de reconexión, las herramientas se desregistran y la reconexión se detiene hasta una recarga o un reinicio. El descubrimiento inicial es asíncrono: espera a que aparezcan las herramientas `mcp__...` del proveedor antes de enviar el primer mensaje de validación.

<a id="bring-another-mcp-server"></a>

## Usar otro servidor MCP

Copia los mismos campos de la entrada y usa valores únicos para `id` y `serverName`:

```yaml
- insert:
    - id: memory-my-server
      name: '@ocean/ocean-mcp-client'
      config:
        serverName: my-memory
        transport: stdio
        command: my-memory-mcp
        args: []
        env: {}
        cwd: !!js process.cwd()
```

Para un servidor remoto, usa en su lugar `transport: streamable-http`, `url` y `headers`. La instalación, la identidad, la autenticación, los modelos, los embeddings, la persistencia y las licencias específicas del proveedor siguen siendo responsabilidad de este.

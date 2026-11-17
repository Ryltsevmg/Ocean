<a id="use-the-web-ui"></a>

# Usar la interfaz web

<!-- USER_LANGUAGES_START -->
[English](index.md) | [中文](index.zh.md) | [Русский](index.ru.md) | [日本語](index.ja.md) | Español | [Français](index.fr.md) | [Deutsch](index.de.md) | [Português](index.pt.md) | [한국어](index.ko.md)
<!-- USER_LANGUAGES_END -->

Inicia la interfaz web siguiendo el [guía de desarrollo](../../development.md); el comando muestra su URL. Esta guía comienza cuando ese servidor ya está en marcha. El proceso `ocean` usa el directorio desde el que lo inicias como ubicación predeterminada del sistema de archivos. La primera vez que abras la interfaz web, añade y selecciona un espacio de trabajo.

<a id="configure-a-model"></a>

## Configurar un modelo

Abre **Ajustes → Modelos** y elige un proveedor de modelos; la [guía de configuración de modelos](./providers.es.md) explica los proveedores admitidos y los endpoints personalizados compatibles con OpenAI. Para una ruta de DeepSeek, introduce tu [clave de API de DeepSeek](https://platform.deepseek.com/) y guárdala. La ruta del modelo queda disponible de inmediato, sin reiniciar el servidor.

<a id="choose-a-workspace"></a>

## Elegir un espacio de trabajo

Pulsa **Elegir espacio de trabajo**, añade el directorio del proyecto desde el que iniciaste `ocean` y selecciónalo. El editor de mensajes de la sesión permanece deshabilitado hasta que elijas un espacio de trabajo.

<a id="run-a-task"></a>

## Ejecutar una tarea

Inicia una sesión y envía:

> Resume este repositorio e identifica sus paquetes principales.

El agente puede leer y editar archivos del espacio de trabajo, ejecutar comandos, delegar trabajo y mantener un plan. La interfaz web pide confirmación antes de las operaciones que requieren aprobación según la política de permisos activa.

<a id="continue"></a>

## Continuar

- [Configurar modelos](./providers.es.md)
- [Configurar un proxy de red](./network-proxy.es.md)
- [Usar la memoria MCP](./mcp-memory.es.md)
- [Programar recordatorios](./schedule.es.md)
- [Usar el SDK de Python](./python-sdk.es.md)
- [Publicar la interfaz web detrás de un proxy inverso](./public-deployments.es.md)
- [Desinstalar Ocean Desktop](./desktop-uninstall-cleanup.es.md)
- [Usar otros modos de la CLI](../../../apps/cli/README.md)
- [Desarrollar un plugin](../develop/basic/index.md)

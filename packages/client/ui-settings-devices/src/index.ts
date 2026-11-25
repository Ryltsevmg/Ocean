/**
 * Devices settings section, node half. The empty apply exists so the plugin
 * appears in the host cordis.yml / Loader; the browser half owns the page
 * through exports["./client"], discovered from the package.json ocean.client
 * declaration. The `devices` namespace the page drives is registered by
 * `@ocean/ocean-api-device-controller`, so this package registers none.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}

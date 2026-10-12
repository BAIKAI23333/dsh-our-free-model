/**
 * 独立端复用插件前端的共享部件。
 *
 * 插件本体已经收窄为免费车道 / EAC / 聚合 / 省 Token / 路由五页；账号渠道包
 * （`vendor/channel-pack`）已从仓库移除，因此这里不再重导出任何渠道页面，
 * 只把独立端仍然编排的三样东西搬出来：
 *
 * - `EacAuth` / `useEacLogin`：EAC 授权与资源池面板；
 * - `DICT` / `Tank` / `usePool` / `poolReading` / `capacityText`：同一套文案与仪表；
 * - `CSS`：插件前端的整份样式，独立端在其后追加少量覆盖。
 *
 * 另外把 `ofm-provider-list` 这个虚拟模块指向插件自带的聚合 provider 注册表，
 * 使独立端模型页的渠道下拉与插件内保持同源。
 */
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let source = fs.readFileSync(new URL('../../client.js', import.meta.url), 'utf8')
function replaceOnce(from, to) {
  if (source.split(from).length !== 2) throw new Error(`共享页面替换位置改变：${from.slice(0, 90)}`)
  source = source.replace(from, to)
}
const anchor = '    exports.apply = apply'
if (source.split(anchor).length !== 2) throw new Error('共享页面导出位置改变')
source = source.replace(anchor, "    exports.standalone = { EacAuth, useEacLogin, DICT, CSS, Tank, usePool, poolReading, capacityText }\n" + anchor)
const api = "try { return new URL('api/our-free-model', document.baseURI).pathname } catch { return '/api/our-free-model' }"
if (source.split(api).length !== 2) throw new Error('共享页面 API 位置改变')
source = source.replace(api, "return '/api/management'")
replaceOnce("api('/pool', { timeout: 25_000 })", "api('/eac/pool', { timeout: 25_000 })")
// 原页面 POST 空 body；独立管理接口要求 JSON 对象。
replaceOnce("...body === undefined ? {} : { body: JSON.stringify(body) },", "body: JSON.stringify(body ?? {}),")
let record
vm.runInNewContext(source, { window: { __ModuleLoader__: { load: value => { record = value } } } })
const shared = record.factory(() => ({})).standalone
const css = shared.CSS + `
.ofm_root{
 max-width:none;
}
.ofm_root button,.ofm_root input,.ofm_root select{font-family:inherit}
.ofm_root img{max-width:100%}
.ofm_root input,.ofm_root select{max-width:100%;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:white;color:inherit}
.ofm_root input[type=checkbox]{padding:0}
`

/** The aggregate lane's provider registry, read from the plugin's own module. */
const registryPath = fileURLToPath(new URL('../../src/providers/registry.json', import.meta.url))
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
const providerRows = (Array.isArray(registry) ? registry : registry.providers ?? [])
  .filter(row => typeof row?.id === 'string' && row.id !== '')
  .map(row => ({ id: row.id, name: typeof row.name === 'string' && row.name !== '' ? row.name : row.id }))
void path

export function standaloneSharedUi() {
  return { name: '独立端共享部件',
    resolveId(id) {
      if (id === 'ofm-shared-client' || id === 'ofm-provider-list') return '\0' + id
      if (id === 'ofm-shared-styles.css') return '\0' + id
    },
    load(id) {
      if (id === '\0ofm-shared-client') return `import * as React from 'react'; export const shared = (${record.factory.toString()})(() => React).standalone;`
      if (id === '\0ofm-shared-styles.css') return css
      if (id === '\0ofm-provider-list') return `export const providers = ${JSON.stringify(providerRows)}`
    },
  }
}

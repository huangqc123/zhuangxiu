const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const miniprogram = path.join(root, 'miniprogram')

function walk(directory, extension, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file, extension, output)
    else if (file.endsWith(extension)) output.push(file)
  }
  return output
}

for (const file of walk(miniprogram, '.wxml')) {
  const source = fs.readFileSync(file, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{[\s\S]*?\}\}/g, 'EXPRESSION')
  const stack = []
  const voidTags = new Set(['input', 'image', 'icon', 'progress'])

  for (const match of source.matchAll(/<\/?([\w-]+)(?:\s[^<>]*?)?\s*\/?>/g)) {
    const raw = match[0]
    const tag = match[1]
    if (raw.startsWith('</')) {
      assert.strictEqual(stack.pop(), tag, `${file} 标签闭合顺序错误：${raw}`)
    } else if (!raw.endsWith('/>') && !voidTags.has(tag)) {
      stack.push(tag)
    }
  }
  assert.deepStrictEqual(stack, [], `${file} 存在未闭合标签：${stack.join(', ')}`)
}

for (const file of walk(miniprogram, '.wxss')) {
  const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  let braces = 0
  for (const character of source) {
    if (character === '{') braces += 1
    if (character === '}') braces -= 1
    assert.ok(braces >= 0, `${file} 存在多余的 }`)
  }
  assert.strictEqual(braces, 0, `${file} 花括号未闭合`)
}

const appConfig = JSON.parse(fs.readFileSync(path.join(miniprogram, 'app.json'), 'utf8'))
assert.ok(appConfig.pages.length >= 4, '页面配置不完整')
for (const page of appConfig.pages) {
  for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
    const file = path.join(miniprogram, `${page}${extension}`)
    assert.ok(fs.existsSync(file), `缺少页面文件：${file}`)
  }
}

assert.strictEqual(appConfig.tabBar.custom, true, '底部导航应使用自定义TabBar')
assert.deepStrictEqual(
  appConfig.tabBar.list.map(item => item.pagePath),
  ['pages/home/index', 'pages/profile/index'],
  '底部导航页面配置不正确'
)
assert.strictEqual(appConfig.tabBar.list[1].text, '我的', '第二个底部导航应为“我的”')
for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
  assert.ok(
    fs.existsSync(path.join(miniprogram, `custom-tab-bar/index${extension}`)),
    `缺少自定义TabBar文件：${extension}`
  )
}

const homeTemplate = fs.readFileSync(path.join(miniprogram, 'pages/home/index.wxml'), 'utf8')
assert.ok(!homeTemplate.includes('第 1 版') && !homeTemplate.includes('第1版'), '首页不应展示版本号')
const guideSource = fs.readFileSync(path.join(miniprogram, 'pages/guide/index.js'), 'utf8')
assert.ok(guideSource.includes('GB 55038-2025'), '用量指南缺少现行住宅项目规范')

const profileTemplate = fs.readFileSync(path.join(miniprogram, 'pages/profile/index.wxml'), 'utf8')
assert.ok(profileTemplate.includes('open-type="share"'), '“我的”页缺少微信好友分享入口')
assert.ok(profileTemplate.includes('意见反馈'), '“我的”页缺少意见反馈入口')
assert.ok(profileTemplate.includes('用户协议') && profileTemplate.includes('隐私政策'), '“我的”页缺少协议入口')

const calculatorTemplate = fs.readFileSync(path.join(miniprogram, 'pages/calculator/index.wxml'), 'utf8')
assert.ok(calculatorTemplate.includes('scene-{{tool.visualType}}'), '计算页缺少材料差异化施工示意图')
assert.ok(calculatorTemplate.includes('open-type="share"'), '计算结果缺少微信好友分享入口')
assert.ok(calculatorTemplate.indexOf('open-type="share"') > calculatorTemplate.indexOf('id="result-anchor"'), '分享按钮必须位于结果自动定位区域内')

const legalSource = fs.readFileSync(path.join(miniprogram, 'pages/legal/index.js'), 'utf8')
assert.ok(legalSource.includes('在法律允许的最大范围内'), '用户协议缺少合规的责任限制表述')
assert.ok(legalSource.includes('不得排除或限制的责任'), '用户协议不得排除法定责任')
assert.ok(legalSource.includes('仅保存在当前设备'), '隐私政策缺少本地数据保存说明')
const appSource = fs.readFileSync(path.join(miniprogram, 'app.js'), 'utf8')
assert.ok(appSource.includes('showAgreementPrompt'), '应用启动时缺少协议确认提示')
assert.ok(appSource.includes('同意继续'), '协议确认提示缺少同意操作')

for (const file of walk(root, '.json')) {
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(file, 'utf8')), `${file} 不是有效JSON`)
}

console.log('Project routes, WXML, WXSS, and JSON structure tests passed')

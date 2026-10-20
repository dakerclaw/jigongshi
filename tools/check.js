/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

/**
 * 静态检查（无需微信开发者工具）
 * 运行：node tools/check.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.workbuddy', 'tmp']);
const errors = [];
let jsCount = 0;
let jsonCount = 0;
let wxssCount = 0;
let wxmlCount = 0;

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((ent) => {
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name), out);
      return;
    }
    out.push(path.join(dir, ent.name));
  });
  return out;
}

const files = walk(ROOT, []);

files.forEach((file) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.js') {
    jsCount += 1;
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (e) {
      errors.push('JS 语法错误: ' + path.relative(ROOT, file) + '\n' + String(e.stderr || e.message));
    }
  } else if (ext === '.json') {
    jsonCount += 1;
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push('JSON 解析失败: ' + path.relative(ROOT, file) + ' - ' + e.message);
    }
  } else if (ext === '.wxss') {
    wxssCount += 1;
    const text = fs.readFileSync(file, 'utf8');
    if (/#8a94a6|#a3a8b0/i.test(text)) {
      errors.push('低对比度颜色: ' + path.relative(ROOT, file));
    }
    if (/(^|[^-])gap\s*:/i.test(text)) {
      errors.push('flex gap 兼容性风险: ' + path.relative(ROOT, file));
    }
  } else if (ext === '.wxml') {
    wxmlCount += 1;
    const text = fs.readFileSync(file, 'utf8');
    if (/<i[\s>]/.test(text)) {
      errors.push('非官方 <i> 标签: ' + path.relative(ROOT, file));
    }
  }
});

// app.json 中登记的页面必须齐全
try {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  (appJson.pages || []).forEach((page) => {
    ['.js', '.json', '.wxml', '.wxss'].forEach((ext) => {
      const p = path.join(ROOT, page + ext);
      if (!fs.existsSync(p)) errors.push('缺少页面文件: ' + page + ext);
    });
  });
} catch (e) {
  errors.push('无法读取 app.json: ' + e.message);
}

// 自定义 tabBar 图标必须存在
try {
  const tabJs = fs.readFileSync(path.join(ROOT, 'custom-tab-bar/index.js'), 'utf8');
  const icons = tabJs.match(/\/assets\/[^'"]+\.png/g) || [];
  icons.forEach((icon) => {
    const p = path.join(ROOT, icon.slice(1));
    if (!fs.existsSync(p)) errors.push('缺少 tabBar 图标: ' + icon);
  });
} catch (e) {
  errors.push('无法读取自定义 tabBar: ' + e.message);
}

console.log(
  '检查完成：' + jsCount + ' 个 JS，' + jsonCount + ' 个 JSON，' + wxssCount + ' 个 WXSS，' + wxmlCount + ' 个 WXML',
);

if (errors.length) {
  console.error('\n发现 ' + errors.length + ' 个问题：');
  errors.forEach((e) => console.error('- ' + e));
  process.exitCode = 1;
} else {
  console.log('全部通过。');
}

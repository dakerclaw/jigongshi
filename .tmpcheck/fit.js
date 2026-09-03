const fs = require('fs');
const path = require('path');
const root = 'D:/WorkBuddy/program/jigongshi';

const jobs = [
  { file: 'app.wxss', reps: [
    ['  --fs-xs: 30rpx;', '  --fs-xs: 28rpx;'],
    ['  --fs-sm: 32rpx;', '  --fs-sm: 30rpx;'],
    ['  --fs-md: 38rpx;', '  --fs-md: 34rpx;'],
    ['  --fs-lg: 44rpx;', '  --fs-lg: 38rpx;'],
    ['  --fs-xl: 54rpx;', '  --fs-xl: 44rpx;'],
    ['  --fs-xxl: 68rpx;', '  --fs-xxl: 56rpx;'],
    ['  --fs-huge: 96rpx;', '  --fs-huge: 84rpx;'],
    ['.section-title {\n  font-size: 52rpx;', '.section-title {\n  font-size: 46rpx;'],
  ]},
  { file: 'pages/record/record.wxss', reps: [
    ['.clock__time {\n  font-size: 100rpx;', '.clock__time {\n  font-size: 88rpx;'],
    ['.list-head__num {\n  font-size: 44rpx;', '.list-head__num {\n  font-size: 40rpx;'],
    ['.result__title {\n  font-size: 48rpx;', '.result__title {\n  font-size: 44rpx;'],
  ]},
  { file: 'pages/month/month.wxss', reps: [
    ['.month-nav__ym {\n  font-size: 48rpx;', '.month-nav__ym {\n  font-size: 40rpx;\n  white-space: nowrap;'],
    ['.sum-card__num {\n  font-size: 96rpx;', '.sum-card__num {\n  font-size: 84rpx;'],
  ]},
  { file: 'pages/history/history.wxss', reps: [
    ['.picker-row__label {\n  font-size: 42rpx;', '.picker-row__label {\n  font-size: 36rpx;'],
    ['.picker-row__value {\n  font-size: 56rpx;', '.picker-row__value {\n  font-size: 44rpx;\n  white-space: nowrap;'],
    ['.sum-card__num {\n  font-size: 96rpx;', '.sum-card__num {\n  font-size: 84rpx;'],
    ['.bar-item__label {\n  flex-shrink: 0;\n  width: 200rpx;\n  font-size: 30rpx;', '.bar-item__label {\n  flex-shrink: 0;\n  width: 200rpx;\n  font-size: 30rpx;\n  white-space: nowrap;'],
  ]},
];

let miss = 0;
for (const job of jobs) {
  const p = path.join(root, job.file);
  let s = fs.readFileSync(p, 'utf8');
  for (const [from, to] of job.reps) {
    if (s.includes(from)) { s = s.replace(from, to); }
    else { console.log('MISS', job.file, '::', JSON.stringify(from)); miss++; }
  }
  fs.writeFileSync(p, s);
}
console.log('done, miss =', miss);

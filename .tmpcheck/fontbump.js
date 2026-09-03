const fs = require('fs');

const rules = [
  // ---------- app.wxss ----------
  ['app.wxss', '  --fs-xs: 28rpx;', '  --fs-xs: 30rpx;'],
  ['app.wxss', '.type-card__sub {\n  font-size: 28rpx;', '.type-card__sub {\n  font-size: 30rpx;'],
  ['app.wxss', '.calc-box__note {\n  font-size: 28rpx;', '.calc-box__note {\n  font-size: 30rpx;'],

  // ---------- pages/record/record.wxss ----------
  ['pages/record/record.wxss', '.shift-card__label {\n  font-size: 30rpx;', '.shift-card__label {\n  font-size: 32rpx;'],
  ['pages/record/record.wxss', '.rec-item__type {\n  margin-top: 10rpx;\n  font-size: 30rpx;', '.rec-item__type {\n  margin-top: 10rpx;\n  font-size: 32rpx;'],
  ['pages/record/record.wxss', '.rec-item__time {\n  margin-top: 4rpx;\n  font-size: 26rpx;', '.rec-item__time {\n  margin-top: 4rpx;\n  font-size: 30rpx;'],
  ['pages/record/record.wxss', '.rec-item__h {\n  font-size: 28rpx;', '.rec-item__h {\n  font-size: 30rpx;'],
  ['pages/record/record.wxss', '.rec-item__units {\n  font-size: 28rpx;', '.rec-item__units {\n  font-size: 30rpx;'],
  ['pages/record/record.wxss', '.list-head__sum {\n  font-size: 32rpx;', '.list-head__sum {\n  font-size: 34rpx;'],
  ['pages/record/record.wxss', '.hint {\n  text-align: center;\n  font-size: 32rpx;', '.hint {\n  text-align: center;\n  font-size: 34rpx;'],
  ['pages/record/record.wxss', '.result__k {\n  font-size: 32rpx;', '.result__k {\n  font-size: 34rpx;'],

  // ---------- pages/month/month.wxss ----------
  ['pages/month/month.wxss', '.table__week {\n  font-size: 26rpx;', '.table__week {\n  font-size: 28rpx;'],
  ['pages/month/month.wxss', '.table__h {\n  font-size: 26rpx;', '.table__h {\n  font-size: 28rpx;'],
  ['pages/month/month.wxss', '.table__units {\n  font-size: 26rpx;', '.table__units {\n  font-size: 28rpx;'],
  ['pages/month/month.wxss', '.day-rec__time {\n  display: block;\n  font-size: 28rpx;', '.day-rec__time {\n  display: block;\n  font-size: 30rpx;'],
  ['pages/month/month.wxss', '.day-rec__u {\n  font-size: 28rpx;', '.day-rec__u {\n  font-size: 30rpx;'],
  ['pages/month/month.wxss', '.day-rec__del {\n  display: inline-block;\n  margin-left: 20rpx;\n  padding: 10rpx 20rpx;\n  font-size: 30rpx;', '.day-rec__del {\n  display: inline-block;\n  margin-left: 20rpx;\n  padding: 10rpx 20rpx;\n  font-size: 32rpx;'],
  ['pages/month/month.wxss', '.sum-card__label {\n  font-size: 28rpx;', '.sum-card__label {\n  font-size: 30rpx;'],
  ['pages/month/month.wxss', '.table__tip {\n  margin-top: 20rpx;\n  text-align: center;\n  font-size: 28rpx;', '.table__tip {\n  margin-top: 20rpx;\n  text-align: center;\n  font-size: 30rpx;'],
  ['pages/month/month.wxss', '.day-sum {\n  margin-top: 20rpx;\n  padding: 20rpx 24rpx;\n  background: #e7f0ff;\n  border-radius: 14rpx;\n  font-size: 34rpx;', '.day-sum {\n  margin-top: 20rpx;\n  padding: 20rpx 24rpx;\n  background: #e7f0ff;\n  border-radius: 14rpx;\n  font-size: 36rpx;'],

  // ---------- pages/history/history.wxss ----------
  ['pages/history/history.wxss', '.stat-row__u {\n  font-size: 26rpx;', '.stat-row__u {\n  font-size: 28rpx;'],
  ['pages/history/history.wxss', '.bar-item__label {\n  flex-shrink: 0;\n  width: 176rpx;\n  font-size: 30rpx;', '.bar-item__label {\n  flex-shrink: 0;\n  width: 200rpx;\n  font-size: 30rpx;'],
  ['pages/history/history.wxss', '.bar-item__track {\n  flex: 1;\n  height: 40rpx;\n  background: #f2f4f7;\n  border-radius: 20rpx;\n  overflow: hidden;\n  margin: 0 16rpx;', '.bar-item__track {\n  flex: 1;\n  height: 40rpx;\n  background: #f2f4f7;\n  border-radius: 20rpx;\n  overflow: hidden;\n  margin: 0 12rpx;'],
  ['pages/history/history.wxss', '.sum-card__label {\n  font-size: 28rpx;', '.sum-card__label {\n  font-size: 30rpx;'],
  ['pages/history/history.wxss', '.hrow__week {\n  font-size: 26rpx;', '.hrow__week {\n  font-size: 28rpx;'],
  ['pages/history/history.wxss', '.hrow__u {\n  font-size: 26rpx;', '.hrow__u {\n  font-size: 28rpx;'],
  ['pages/history/history.wxss', '.hrow__units {\n  font-size: 26rpx;', '.hrow__units {\n  font-size: 28rpx;'],
];

let miss = 0;
for (const [file, from, to] of rules) {
  let s;
  try { s = fs.readFileSync(file, 'utf8'); }
  catch (e) { console.log('MISS-FILE ', file, e.message); miss++; continue; }
  if (s.indexOf(from) < 0) { console.log('MISS-MATCH', file, JSON.stringify(from.slice(0, 40))); miss++; continue; }
  s = s.replace(from, to);
  fs.writeFileSync(file, s);
  console.log('OK        ', file, '|', from.split('\n')[0].trim());
}
console.log('\n未命中规则数:', miss);
